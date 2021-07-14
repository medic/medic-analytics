#base Build
ARG node_version=10
FROM node:$node_version as base_couch2pg_build
RUN apt-get update
RUN apt-get -y install postgresql-client curl
WORKDIR /app
COPY . .
RUN npm ci

#Test build
FROM base_couch2pg_build AS test-couch2pg
WORKDIR /app
RUN git submodule update --init
RUN npm i -g grunt-cli


# Final
FROM base_couch2pg_build AS medic-couch2pg
WORKDIR /app
RUN rm -rf tests
ENTRYPOINT [ "/app/couch2pg-entrypoint.sh" ]
CMD ["main"]