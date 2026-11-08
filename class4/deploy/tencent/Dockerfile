# Runtime-only image built from the verified ClassFire CI artifact.
# Build context: extracted classfire-candidate-with-source.tar.gz root.
FROM node:22.22.3-bookworm-slim
ENV NODE_ENV=production NITRO_HOST=0.0.0.0 NITRO_PORT=3000 TZ=Asia/Shanghai
WORKDIR /app
RUN mkdir -p /app/data && chown node:node /app/data
COPY --chown=node:node .output/ .output/
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "require('node:http').get('http://127.0.0.1:3000/api/settings/public',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", ".output/server/index.mjs"]
