const express = require("express");
const GiphyApiClient = require("giphy-js-sdk-core");
const Twitter = require("twitter-lite");

const secrets = require("../../secrets.json");

const app = express();

app.use(express.static("dist"));

const giphyClient = GiphyApiClient(secrets.GIPHY_API_KEY);

async function searchGiphy(q, limit) {
    const res = await giphyClient.search("gifs", {
        q,
        sort: "relevant",
        lang: "en",
        limit,
    });

    return res.data.map((gif) => {
        return {
            title: gif.title,
            image: gif.images.original.url,
            url: gif.url,
            source: "giphy",
        };
    });
}

const twitterClient = new Twitter({
    bearer_token: secrets.TWITTER_BEARER_TOKEN,
});

function tweetImage(tweet) {
    const entities = [tweet.extended_entities, tweet.entities];

    for (let i = 0; i < entities.length; i += 1) {
        if (entities[i] && entities[i].media && entities[i].media.length > 0) {
            return entities[i].media[0].media_url_https;
        }
    }

    return "";
}

async function searchTwitter(q, limit) {
    const res = await twitterClient.get("search/tweets", {
        q,
        count: limit,
    });

    return res.statuses.map((tweet) => {
        const card = {
            body: tweet.text,
            url: `https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`,
            source: "twitter",
        };

        const image = tweetImage(tweet);
        if (image !== "") {
            card.image = image;
        }

        return card;
    });
}

const searchers = {
    giphy: searchGiphy,
    twitter: searchTwitter,
};

function uniqueSources(sources) {
    return Array.from(
        new Set(
            Object.keys(searchers)
                .concat(sources)
                .filter((s) => s)
        )
    ).sort((a, b) => a - b);
}

app.get("/api/search", async (req, res) => {
    const query = [].concat(req.query.q);
    const sources = uniqueSources(req.query.sources);

    const data = await Promise.all(
        sources.map((src) => {
            if (searchers[src]) {
                return searchers[src](query[0], 10);
            }
            return Promise.resolve([]);
        })
    );

    const results = {};
    sources.forEach((src, i) => {
        results[src] = data[i];
    });

    res.json(results);
});

app.listen(process.env.PORT || 8080, () =>
    console.log(`Listening on port ${process.env.PORT || 8080}!`)
);
