var express = require('express'),
    app = express(),
    crypto = require('crypto'),
    fs = require('fs'),
    sharp = require('sharp'),
    puppeteer = require('puppeteer'),
    base64 = require('base64-stream');

///////////
// CONFIG
//////////
var maxRunningParralelRenderingJobs = 2;
//////////

var runningProcessCounter = 0;

var removeURLParameter = function(url, parameter) {
    //prefer to use l.search if you have a location/link object
    var urlparts= url.split('?');   
    if (urlparts.length>=2) {

        var prefix= encodeURIComponent(parameter)+'=';
        var pars= urlparts[1].split(/[&;]/g);

        //reverse iteration as may be destructive
        for (var i= pars.length; i-- > 0;) {    
            //idiom for string.startsWith
            if (pars[i].lastIndexOf(prefix, 0) !== -1) {  
                pars.splice(i, 1);
            }
        }

        url= urlparts[0] + (pars.length > 0 ? '?' + pars.join('&') : "");
        return url;
    } else {
        return url;
    }
};

var processRequest = async function (req, res, loopcount) {

    console.log("**************************");
    var reqUrl = req.protocol + '://' + req.get('Host') + req.url;
    console.log(reqUrl);

    if (typeof loopcount == "undefined") loopcount = 0;

    try {

        // secure delete all temp files - just in case cleanup did not woirk
        if (runningProcessCounter==0) {
            try {
             fs.readdirSync('screenshots').forEach(function(file,index){
                var curPath = 'screenshots' + "/" + file;
                if(!fs.lstatSync(curPath).isDirectory()) { // recurse
                    fs.unlinkSync(curPath);
                }
            });
           } catch(e) {
               console.error("FAIL on cleaning temp files.",e);
           }
        }

        // if already too much process running - send into redirection rebound after delay
        if (runningProcessCounter>maxRunningParralelRenderingJobs) {

            var bounceCounter = 0;
            try {
                
                if ((typeof req.query.bounceCounter != "undefined")) {

                    // use value from url
                    if (!isNaN(req.query.bounceCounter)) {
                        bounceCounter = req.query.bounceCounter;
                        if (bounceCounter>20) {
                            console.log("bounceCounter is VERY HIGH ... limit to 20");
                            bounceCounter=20;
                        }
                        if (bounceCounter<1) {
                            console.log("bounceCounter is NOT POSITIVE ... set to 1");
                            bounceCounter=1;
                        }
                        bounceCounter++;
                    } else {
                        console.log("bounceCounter was not a number");
                    }

                    // remove from parameter form url string
                    reqUrl = removeURLParameter(reqUrl, "bounceCounter");

                }
            } catch (e) { console.log("FAIL on bounceCounter upcounting"); }

            // calculate delay until rebound
            var delay = (bounceCounter * 1000) + 1;

            // add bounceCounter to redirect url
            reqUrl = reqUrl + "&bounceCounter=" + bounceCounter;

            console.log("BUSY REDIRECT (delay: "+delay+") --> "+reqUrl);
            setTimeout(function(){
                res.status(302);
                res.set('Location', reqUrl);
                res.send(reqUrl);
            }, delay);
            return;
        }
    } catch (e) {
        console.error("EXCEPTION ON WAIT LOOP");
    }

    runningProcessCounter++;

    try {

    if (typeof req.query.url == "undefined") {
        res.status(500);
        res.send("missing parameter 'url'");
        return;
    }

    var scale = ((req.query.scale) && (!isNaN(req.query.scale))) ? req.query.scale : '1';
    if (scale>5) scale=5;
    if (scale<0.01) scale=0.01;

    var url = req.query.url,
        urlHash = crypto.createHash('md5').update(url + '-scale:1').digest('hex'),
        imgHash = crypto.createHash('md5').update(url + '-scale:' + scale).digest('hex'),
        imgOriginalPath = 'screenshots/' + urlHash + '.png',
        imgPath = 'screenshots/' + imgHash + '.png',
        options = {
            phantomConfig: {
                'ignore-ssl-errors': 'true',
                'ssl-protocol': 'any'
            },
            quality: 100,
            renderDelay: 2000
        };

        console.log("PROCESSING START");
        console.log(url, urlHash, imgPath);

        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.goto(url, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });
        await page.setViewport({
            width: 1024,
            height: 768,
            deviceScaleFactor: 1
        });
        await new Promise(resolve => setTimeout(resolve, options.renderDelay));
        await page.screenshot({
            path: imgOriginalPath,
            fullPage: false
        });
        await browser.close();

        /*
         * WIN
         */
        res.setHeader('Content-Type', 'image/png');
        
        // Check if we need to scale
        if (scale === '1') {
            // If no scaling needed, use original file directly
            var stream = fs.createReadStream(imgOriginalPath)
        } else {
            // If scaling needed, create a new scaled file
            await sharp(imgOriginalPath)
                .resize({ scale: parseFloat(scale) })
                .png()
                .toFile(imgPath);
            var stream = fs.createReadStream(imgPath);
        }

        stream.on('error', function (err) {
            res.status(500);
            res.send('An error occured: ' + err);
            console.error(err);
            runningProcessCounter--;
            return;
        })
        .on('close', function () {
            console.log("PROCESSING DONE");
            console.log(url, urlHash, imgPath);
            // delete after writing to stream
            try {
                if (scale !== '1') {  // Only delete scaled image
                    fs.unlinkSync(imgPath);
                }
                fs.unlinkSync(imgOriginalPath);  // Always delete original
            } catch (e) {
                console.log("NO SUCCESS cleaning temp files - tolerate and continue");
            }
        });

        // add base64 decoding if wanted by url parameter
        if (req.query.base64) {
            console.log("Content-Transfer-Encoding > BASE64");
            res.setHeader('Content-Transfer-Encoding', 'base64');
            stream.pipe(base64.encode())
                .pipe(res);
        } else {
            stream.pipe(res);
        }

    } catch (e) {
        res.status(500);
        console.error("EXCEPTION");
        console.error(url, urlHash, imgPath);
        res.send('An error occured: ' + JSON.stringify(e));
        console.error(e);
        runningProcessCounter--;
        return;  
    }

};

app.get('/screenshot', (req, res) => processRequest(req, res));

// Add healthcheck endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        runningProcesses: runningProcessCounter
    });
});

app.listen(2341);
console.log('Running on port 2341 - for testing call: http://localhost:2341/?url=http://google.com');
console.log('CONFIG maxRunningParralelRenderingJobs='+maxRunningParralelRenderingJobs);
console.log('Make sure service has about '+((maxRunningParralelRenderingJobs+1)*250)+'MB RAM available');