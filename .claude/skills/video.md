# Adding YouTube Videos to the Videos Page

## Extracting the video ID

YouTube URLs often carry query parameters (e.g. `?si=...`, `?t=...`). Only the
bare 11-character video ID belongs in the `videos` array — strip everything else.

| URL form | ID |
|---|---|
| `https://youtu.be/Vxnf_3Bxj2o?si=m40n5CuB8TwKHzlB` | `Vxnf_3Bxj2o` |
| `https://www.youtube.com/watch?v=aPBqf72X-I8&t=42s` | `aPBqf72X-I8` |

## Fetch metadata for a YouTube video ID

Use `curl` to get the upload date and oEmbed title:

```bash
# Upload date (DD.MM.YYYY)
curl -s "https://www.youtube.com/watch?v=VIDEO_ID" \
  | grep -o '"dateText":{"simpleText":"[^"]*"' | head -1

# Title
curl -s "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=VIDEO_ID&format=json" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('title',''))"
```

Do this for all IDs in one shell loop:

```bash
for id in ID1 ID2 ID3; do
  date=$(curl -s "https://www.youtube.com/watch?v=$id" \
    | grep -o '"dateText":{"simpleText":"[^"]*"' | head -1)
  title=$(curl -s "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=$id&format=json" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('title',''))" 2>/dev/null)
  echo "$id | $date | $title"
done
```

## Adding entries

Edit `frontend/components/Videos.svelte`. Add objects to the `videos` array, then **sort by `date` descending** (newest first) and **remove duplicate `id`s**.

Each entry shape:

```ts
{
  id: "VIDEO_ID",
  title: "Title as returned by oEmbed",
  date: "YYYY-MM-DD",      // for sorting
  label: "Mon DD, YYYY",   // human-readable display
  start: 10863,            // optional: start time in seconds (from ?t= or &t= in URL)
  blurb: "One or two sentences describing the content.",
}
```

If the URL contains `?t=NNN` or `&t=NNN`, extract the number and set `start: NNN`.
The embed URL becomes `https://www.youtube.com/embed/ID?start=NNN` automatically.

## Deploy

```bash
npm run deploy:local
```
