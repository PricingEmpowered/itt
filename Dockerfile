# Price Space, packaged to run the local demo.
#
# Single stage on purpose. The server is TypeScript run through tsx, which is a
# development dependency, so the image keeps the full dependency set rather than
# a pruned production one. That makes it larger than a production image would be.
# A production install should not use this file as it stands: see DEMO.md.
FROM node:22-bookworm-slim

WORKDIR /app

# Dependencies first, so editing source does not reinstall them. NODE_ENV is set
# only after the build: `npm ci` skips dev dependencies under production, and
# the frontend build needs them.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# A checkout on Windows can turn this script's line endings into CRLF, which a
# Linux shell rejects on its first line and the container then exits. Stripping
# them here makes the image build the same whichever way the files arrived.
RUN sed -i 's/\r$//' docker/demo-entrypoint.sh

RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=120s --retries=5 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Run through sh so the script does not depend on its file mode surviving a copy.
ENTRYPOINT ["sh", "/app/docker/demo-entrypoint.sh"]
