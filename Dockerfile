FROM node:16
WORKDIR /app
RUN apt-get update && apt-get install curl gnupg -y \
  && curl --location --silent https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
  && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
  && apt-get update \
  && apt-get install -y  google-chrome-stable --no-install-recommends\
  && rm -rf /var/lib/apt/lists/*
COPY package.json .
COPY package-lock.json .
COPY tsconfig.json .
RUN npm i
COPY src ./src
RUN npm run build
CMD ["node","build/main.js"]
