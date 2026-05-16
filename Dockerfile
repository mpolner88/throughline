FROM node:22-slim

WORKDIR /app

COPY . .

ENV HOST=0.0.0.0
ENV PORT=5180

CMD ["npm", "start"]
