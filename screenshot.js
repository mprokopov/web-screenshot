var webshot = require('webshot'),
    express = require('express'),
    app = express(),
    crypto = require('crypto'),
    fs = require('fs'),
    lwip = require('lwip');
    stream = require('stream');
    base64 = require('base64-stream');

var runningProcessCounter = 0;

var processRequest = function (req, res, loopcount) {

    console.log("**************************");
    var reqUrl = req.protocol + '://' + req.get('Host') + req.url;
    console.log(reqUrl);

    if (typeof loopcount == "undefined") loopcount = 0;

    try {
        if (runningProcessCounter>0) {
            // drop request if over 500 requests waiting
            if (runningProcessCounter>500) {
                res.status(500);
                res.send('service overload');
                return;
            }
            console.log("BUSY REDIRECT");
            setTimeout(function(){
                res.status(302);
                res.set('Location', reqUrl);
                res.send(reqUrl);
            }, 2000);
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
                                    fs.unlink(imgPath);
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
                        fs.unlink(imgPath);
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
