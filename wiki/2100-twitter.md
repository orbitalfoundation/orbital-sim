I'd probably actually intially just scan my own bookmarks, favorites and so on.

1) i want to scan and aggregate content from my twitter dataset - data/twitter into mongo; we can invent a new local database called scannerdata in the local mongo instance for now. i made a folder in src/twitter_scanner for this. the raw data is in data/twitter. also i added a .env with the new twitter api token keys for the brand new twitter api if you need it. i strongly prefer js, es6, and if there are any twitter api libraries that might be nice.

2) we can try store my tweets - but i am actually less interested in what i tweeted right now. this could be deferred, and upserted later... since this entire scanner will run over and over as i improve it we need a pattern that will be smart about existing data from previous scans.

I have several data aggregation and analysis topics to pursue. This is driven by a serveral deep few goals:



3) right now for this pass am very interested in what i hearted, liked, reposted or bookmarked; i need to dereference the subject matter that i referenced here and do semantic analsys of it and tag it; specifically i want to identify a few separate topics specifically right now:

	- llm-design ... articles about llm memory, or improving llms themselves

	- economic ... articles or posts about world affairs, energy and material flows around the world

	- polymarket ... articles about writing polymarket bots, or any kind of market prediction or speculation








