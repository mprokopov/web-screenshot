var webshot = require('webshot'),
    express = require('express'),
    app = express(),
    crypto = require('crypto'),
    fs = require('fs'),
    lwip = require('lwip');
    stream = require('stream');
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

var processRequest = function (req, res, loopcount) {

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
                        if (bounceCounter>100) {
                            console.log("bounceCounter is VERY HIGH ... limit to 100");
                            bounceCounter=100;
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
            var delay = bounceCounter * 2000;

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

    var url = req.query.url,
        scale = req.query.scale ? req.query.scale : '1',
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

        webshot(url, imgOriginalPath, options, function (err) {
            if (err) {

                /*
                 * FAIL
                 */

                res.status(500);
                res.send('An error occured: ' + err);
                console.error(err);

            } else {

                /*
                 * WIN
                 */
                res.setHeader('Content-Type', 'image/png');
                lwip.open(imgOriginalPath, function (err, image) {
                    try {
                        image.batch()
                            .scale(parseFloat(scale))
                            .writeFile(imgPath, function (err) {
                                if (err) {
                                    res.status(500);
                                    res.send('An error occured: ' + err);
                                    console.error(err);
                                    runningProcessCounter--;
                                    return;
                                }
                                var stream = fs.createReadStream(imgPath)
                                .on('error', function (err) {
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
                                    fs.unlinkSync(imgPath);
                                });

                                // add base64 decoding if wanted by url parameter
                                if (req.query.base64) {
                                    console.log("Content-Transfer-Encoding > BASE64");
                                    res.setHeader('Content-Transfer-Encoding', 'base64');
                                    //res.send('data:image/png;base64,');
                                    stream.pipe(base64.encode())
                                    .pipe(res);
                                } else {
                                    stream.pipe(res);
                                }
                            });

                    } catch (e) {
                        console.log("FAIL - try to clean up:"+e);
                        console.log(url, urlHash, imgPath);
                        console.dir(e);
                        // delete after writing to stream
                        try {
                            fs.unlinkSync(imgPath);
                        } catch (e) {
                            console.log("nothing to clean");
                        }    
                    }
                    }

                    );
                }
                runningProcessCounter--;

        });

    } catch (e) {
        res.status(500);
        console.error("EXCEPTION");
        console.error(url, urlHash, imgPath);
        res.send('An error occured: ' + JSON.stringify(e));
        console.error(e);
        runningProcessCounter++;
        return;  
    }

};

app.get('/', processRequest);
app.listen(2341);
console.log('Running on port 2341 - for testing call: http://localhost:2341/?url=http://google.com');
console.log('CONFIG maxRunningParralelRenderingJobs='+maxRunningParralelRenderingJobs);
console.log('Make sure service has about '+((maxRunningParralelRenderingJobs+1)*250)+'MB RAM available');