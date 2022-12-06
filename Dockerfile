FROM node:latest

RUN apt-get update
RUN apt-get install -y git npm

WORKDIR /home/portalex

RUN git clone https://github.com/portal-hq/portalex.git -b portalex-mpc /home/portalex

RUN npx yarn

ENTRYPOINT []
