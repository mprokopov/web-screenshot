web-screenshot
==============

## RUN AS DOCKER CONTAINER (for production)

docker build -t="web-screenshot" .
docker run -d --name web-screenshot -p 2341:2341 web-screenshot
docker logs web-screenshot -f

## RUN LOCAL (for dev)

Make sure NodeJS is installed - tested with v6.10.1. (`nvm use`)

INSTALL PHANTOM JS (global)

To enable Woff support, follow [these steps](http://squallssck.github.io/blog/2013/03/07/about-how-to-make-phantomjs-support-google-web-fonts/).

If you don't need Woff support, just run: `npm install -g phantomjs-prebuilt`.

RUN APP

To get the app going, do:

```
npm install
node screenshot
```

Now you can render any page you like via `http://localhost:2341/?url=http://google.com`.