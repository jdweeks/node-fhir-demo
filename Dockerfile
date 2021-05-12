FROM node:14.16.1

RUN apt-get -y update && apt-get clean

WORKDIR /srv/app

COPY . /srv/app

RUN yarn install

CMD yarn start
