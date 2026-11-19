/*
  # Make the demo data identical on every install

  The demo seeds draw product costs, statuses, customer volumes and quote
  history from random(), so two installs were different and a demo could not be
  repeated: the same part cost $99 on one machine and $342 on the next, and a
  sample request or a walkthrough written against one was wrong on the other.

  Fixing the random seed makes every draw that follows reproducible. The runner
  applies all steps on one connection, in order, and this file sorts ahead of
  the other demo seeds, so the sequence they consume is the same each time.

  The seed value itself means nothing. Changing it gives a different but equally
  repeatable set of data, and would invalidate any sample file written against
  the current one, so it should not be changed casually.

  This file is only ever run with --with-demo-data. It has no effect on a real
  install, and none on a database that has already applied the other seeds.
*/

SELECT setseed(0.4242);
