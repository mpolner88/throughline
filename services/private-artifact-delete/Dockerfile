FROM node:22-alpine

WORKDIR /app
COPY --chown=node:node package.json server.mjs ./

ENV HOST=0.0.0.0
ENV PORT=8080
USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.mjs"]
