FROM node:latest

# create a new user
RUN useradd --user-group --create-home --shell /bin/false app

#Create directory structure
ENV HOME=/home/app
ADD ./package.json $HOME/package.json
ADD ./screenshots $HOME/screenshots
ADD ./screenshot.js $HOME/screenshot.js

ENV NODE_PATH=$HOME/node_modules

RUN chown -R app:app $HOME/*

#Change to the new user
USER app
WORKDIR $HOME
RUN npm install
CMD ["node", "./screenshot.js"]