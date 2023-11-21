FROM debian:latest

RUN apt update
RUN apt install curl build-essential git python3 python3-pip imagemagick graphicsmagick -y

SHELL ["/bin/bash", "--login", "-c"]
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash

WORKDIR /app/msafe
COPY . .

RUN nvm install
RUN npm install --global yarn
RUN yarn install

RUN yarn -v
RUN node -v
RUN npm -v

ENTRYPOINT ["/bin/bash", "--login", "-c", "yarn start"]
