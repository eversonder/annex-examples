#!/bin/sh
# Runs in every sandbox of the fleet: take a job from the shared queue, do it,
# write the result to the shared store, say it's done, and take the next. It
# ends when the queue stays empty. Annex puts ANNEX_URL, ANNEX_WORKSPACE_ID,
# ANNEX_TASK_ID and ANNEX_TASK_TOKEN in every sandbox's environment.
#
# The job here is small on purpose (fetch a page, count its words). Replace
# do_job with your own: run a migration on one file, a test shard, a scrape.
T="$ANNEX_URL/v1/workspaces/$ANNEX_WORKSPACE_ID/tasks/$ANNEX_TASK_ID"
api() { curl -fsS -X "$1" "$T$2" -H "Authorization: Bearer $ANNEX_TASK_TOKEN" -H 'Content-Type: application/json' ${3:+-d "$3"}; }
field() { sed -n "s/.*\"$1\":\"\([^\"]*\)\".*/\1/p" | head -1; }

do_job() { curl -fsSL --max-time 30 "$1" | wc -w | tr -d ' '; }

empty=0
while [ "$empty" -lt 3 ]; do
  msg=$(api POST /queues/jobs/claim '{"max":1,"visibility_seconds":120}')
  id=$(printf %s "$msg" | field id)
  if [ -z "$id" ]; then empty=$((empty + 1)); sleep 2; continue; fi
  empty=0
  url=$(printf %s "$msg" | field url)
  words=$(do_job "$url" 2>/dev/null || echo 0)
  key=$(printf %s "$url" | tr -c 'a-zA-Z0-9' '-')
  api PUT "/kv/results-$key" "{\"value\":{\"url\":\"$url\",\"words\":$words,\"by\":\"$ANNEX_SANDBOX_ID\"}}" >/dev/null
  api POST "/queues/jobs/messages/$id/ack" >/dev/null
done
