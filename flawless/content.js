(function () {
    "use strict";

    console.log("loaded");

    setInterval(() => {
        // auto click all "read more" buttons
        //
        $('button[data-testid="tweet-text-show-more-link"]').each((index, element) => {
            $(element).click();
        });

        // auto click all "load more" buttons
        //
        $('section > div > div > div[data-testid="cellInnerDiv"] > div > button').each((index, element) => {
            console.log(`clicking load more button ${index}`);
            $(element).click();
        });
    }, 2000);

    $(function () {
        console.log("document ready");
        const processedMarker = 'data-sentiment-processed';

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) {
                    return;
                }

                const elem = $(entry.target);

                if (elem.attr(processedMarker)) {
                    observer.unobserve(entry.target);
                    return;
                }

                if (elem.attr('data-sentiment')) {
                    observer.unobserve(entry.target);
                    return;
                }

                if (elem.next().attr('data-sentiment')) {
                    observer.unobserve(entry.target);
                    return;
                }

                elem.attr(processedMarker, 'true');
                observer.unobserve(entry.target);

                const text = elem.text();
                console.log('analyzing tweet text:', text);

                const clone = elem.clone();

                clone.text('Loading sentiment...');
                clone.attr('data-sentiment', 'true');

                clone.css({
                    'margin-top': '10px',
                    'font-style': 'italic',
                    'color': '#555',
                    'background-color': '#f0f0f0',
                });

                // append the clone element after the original
                //
                elem.after(clone);

                chrome.runtime.sendMessage({
                    type: 'ANALYZE_SENTIMENT',
                    text
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.warn('Sentiment request failed', chrome.runtime.lastError.message);
                        clone.text('Sentiment unavailable');
                        return;
                    }

                    if (!response) {
                        clone.text('No sentiment result');
                        return;
                    }

                    if (response.error) {
                        clone.text('Sentiment error');
                        console.warn('Sentiment analysis error', response.error);
                        return;
                    }

                    clone.text(response.sentiment);
                });
            });
        }, {
            root: null,
            threshold: 0.2,
        });

        const registerTweetElements = () => {
            $('div[data-testid="tweetText"]').each((_, element) => {
                const el = $(element);

                if (el.attr('data-sentiment')) {
                    return;
                }

                if (el.attr(processedMarker)) {
                    return;
                }

                if (el.data('sentimentObserved')) {
                    return;
                }

                el.data('sentimentObserved', true);
                observer.observe(element);
            });
        };

        registerTweetElements();

        const mutationObserver = new MutationObserver(() => {
            registerTweetElements();
        });

        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
        });
    });

    chrome.runtime.onMessage.addListener((message) => {
        if (!message) {
            console.log("Received empty message");
            return;
        }

        switch (message.type) {
        case "DISAGREE_CLICKED":
            console.log("Disagree button was clicked in the popup");

            break;

        case "LOAD_MORE_CLICKED":
            console.log("Load More button was clicked in the popup");
            break;

        default:
            console.log("Unknown message type received:", message.type);
            break;
        }
    });
})();
