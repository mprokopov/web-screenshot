var webshot = require('webshot'),
    express = require('express'),
    app = express(),
    crypto = require('crypto'),
    fs = require('fs'),
    lwip = require('lwip');
    stream = require('stream');
    base64 = require('base64-stream');

app.get('/', function (req, res) {

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
                                    return;
                                }
                                var stream = fs.createReadStream(imgPath)
                                .on('error', function (err) {
                                        res.status(500);
                                        res.send('An error occured: ' + err);
                                        console.error(err);
                                        return;
                                })
                                .on('close', function () {
                                    console.log("OK & delete");
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
                        console.dir(e);
                        // delete after writing to stream
                        fs.unlink(imgPath);
                    }
                    }

                    );
                }

        });

});

app.listen(2341);
console.log('Running on port 2341 - for testing call: http://localhost:2341/?url=http://google.com');
