web-screenshot
==============

Is a state-less micro service to render a preview image of an URL. Simply takes a URL and returns a image. 

## USING THE SERVICE AS A CLIENT

You can test out the service in simple browser by calling for example `http://localhost:2341/?url=http://google.com` when running on localhost. As you see it you just give the URL to render as a parameter 'url' (for production use make sure url parameter value is URLencoded). This will return a rendered image of the given URL. 

The size of the rendered image is 1024 × 768. You can use the parameter `scale` to make a bigger (e.g. 1.5) or a smaller image (e.g. 0.5).

You can also get the rendered image data back as a BASE64 encoded string. For this option add the pameter value `base64=true` to the url. For example `http://localhost:2341/?base64=true&url=http://google.com`. The returned image is a PNG. So if you want to use the BASE64 string as inline img src data in a HTML page add a `data:image/png;base64,` in front of the service result.

DONT RUN SERVICE ON HTTPS - its all public data, no screts involved. Redirect Load Bouncing will not work with HTTPS.

## RUN FROM DOCKER HUB (without git checkout, for production)

```
docker run -d --name web-screenshot -p 2341:2341 rootzoll/web-screenshot
```

## BUILD LOCAL AND RUN AS DOCKER CONTAINER (for production)

```
docker build -t="rootzoll/web-screenshot" .
docker run -d --name web-screenshot -p 2341:2341 rootzoll/web-screenshot
docker logs web-screenshot -f
```

To push new image to dockerhub after local build:

```
docker login
docker push rootzoll/web-screenshot
```

## RUN LOCAL (for dev)

Make sure NodeJS is installed - tested with v6.10.1. (`nvm use`)

### INSTALL PHANTOM JS (global)

To enable Woff support, follow [these steps](http://squallssck.github.io/blog/2013/03/07/about-how-to-make-phantomjs-support-google-web-fonts/).

If you don't need Woff support, just run: `npm install -g phantomjs-prebuilt`.

### RUN APP

To get the app going, do:

```
npm install
node screenshot
```

Now you can render any page you like via `http://localhost:2341/?url=http://google.com`.

## STRESSTEST AND RESOURCES FOR PRODUCTION

For stress testing you can open the Java Eclipse project in the subfolder `javatest` and run the class `StressTest.java` (run as Java Application). It will produce 250 parallel redering requests mixed with bad For monitoring the stress test you can use cAdviser with http://localhost:8080/ running in another docker container:

```
docker run                                      \
  --volume=/:/rootfs:ro                         \
  --volume=/var/run:/var/run:rw                 \
  --volume=/sys:/sys:ro                         \
  --volume=/var/lib/docker/:/var/lib/docker:ro  \
  --publish=8080:8080                           \
  --detach=true                                 \
  --name=cadvisor                               \
  google/cadvisor:latest 
  ```

Monitoring results showed that docker conatiner should have available 2 cores and with maxRunningParralelRenderingJobs=2 as default config in script, the service should have available up to 750 MB of RAM (500 MB per container would be OK too).

## SCALING NOTES

The service is written that way that it renders 2 requests in parallel by default. One rendering take about 5 seconds. If more requests are received and service is busy it hold the request for a short waiting period then will return a HTTP redirect to the same url (adding a bounceCounter to the URL). The bigger the bounceCounter get the longer the waiting period before redirect gets returned to client.

This way the service can proven by the stresstest manage even 250 parrallel renderings requests, but most requests will take a long time to finish. To scale up the service it should be easy to startup multiple service containers and place a load balancer with a simple round robin over all available service containers at the front. So this way if a single service is busy it will return a HTTP redirect to client with basicly the same url, the HTTP client will make a new call to the load balancer and chances are high that this time the balancer directs the client to a idle service container instance. Most HTTP clients tolerate around 20 redirects. 