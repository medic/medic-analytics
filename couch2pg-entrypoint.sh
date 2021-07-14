#!/bin/bash

set -e
WAIT_THRESHOLD="${WAIT_THRESHOLD:-20}"
SLEEP_SECONDS="${SLEEP_SECONDS:-5}"

welcome_message(){
  echo "Starting couch2pg process">&2
}

set_postgres_url(){
  export POSTGRESQL_URL=postgres://$POSTGRES_USER_NAME:$POSTGRES_PASSWORD@$POSTGRES_DB:5432/$POSTGRES_DB_NAME
  echo "Set postgres URL to $POSTGRESQL_URL" >&2
}

check_if_postgres_is_ready(){
  #waiting for postgres
  wait_count=0
  until  pg_isready -q  -h $POSTGRES_DB -U $POSTGRES_USER_NAME --d $POSTGRES_DB_NAME
  do
    echo "Waiting for PostgreSQL..." >&2
    wait_count=$((wait_count +1))
    if [[ "$wait_count" -gt $WAIT_THRESHOLD ]]; then
      echo "No  PostgreSQL DB Found" >&2
      exit 1
    fi
    sleep $SLEEP_SECONDS
  done
echo "Postgres is ready moving on ...">&2
}


check_if_api_is_ready(){
  # check if api is up
  wait_count=0
  until curl -s --head  --request GET $API_URL $| grep "200 OK" > /dev/null
  do
    echo "Waiting for cht api" >&2
    wait_count=$((wait_count +1))
    if [[ "$wait_count" -gt $WAIT_THRESHOLD ]]; then
      echo "No api end point Found" >&2
      exit 1
    fi
    sleep $SLEEP_SECONDS
  done
  echo "api  is ready">&2

}

launch_couchdb(){
  node index.js
}


main (){

welcome_message
set_postgres_url
check_if_api_is_ready
check_if_postgres_is_ready
echo "Launching couchdb">&2
launch_couchdb
}


"$@"