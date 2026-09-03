async function analyzeStock() {

    const stock = document.getElementById("stockInput").value
        .trim()
        .toUpperCase();

    if (!stock) {
        alert("Stock symbol enter karo");
        return;
    }

    try {

        const url = `/api/stock?symbol=${encodeURIComponent(stock)}`;

        const response = await fetch(url);
        const result = await response.json();

        if (!response.ok || result.error) {
            throw new Error(result.error || "Stock not found");
        }

        const history = result.history || [];

        if (history.length < 200) {
            throw new Error("200 days ka data available nahi hai");
        }

        // =====================================================
        // BASIC STOCK DATA
        // =====================================================

        const closes = history
            .map(item => Number(item.close))
            .filter(value => !isNaN(value));

        const volumes = history
            .map(item => Number(item.volume || 0));

        const price = Number(result.price);

        // =====================================================
        // MOVING AVERAGE
        // =====================================================

        function movingAverage(data, period) {

            if (data.length < period) {
                return null;
            }

            const slice = data.slice(-period);

            const sum = slice.reduce(
                (total, value) => total + value,
                0
            );

            return sum / period;
        }

        const dma20 = movingAverage(closes, 20);
        const dma50 = movingAverage(closes, 50);
        const dma200 = movingAverage(closes, 200);

        // =====================================================
        // RSI 14
        // =====================================================

        function calculateRSI(data, period = 14) {

            if (data.length <= period) {
                return null;
            }

            let gains = 0;
            let losses = 0;

            for (let i = 1; i <= period; i++) {

                const change = data[i] - data[i - 1];

                if (change > 0) {
                    gains += change;
                } else {
                    losses += Math.abs(change);
                }
            }

            let averageGain = gains / period;
            let averageLoss = losses / period;

            for (let i = period + 1; i < data.length; i++) {

                const change = data[i] - data[i - 1];

                const gain = change > 0 ? change : 0;
                const loss = change < 0 ? Math.abs(change) : 0;

                averageGain =
                    ((averageGain * (period - 1)) + gain) / period;

                averageLoss =
                    ((averageLoss * (period - 1)) + loss) / period;
            }

            if (averageLoss === 0) {
                return 100;
            }

            const relativeStrength =
                averageGain / averageLoss;

            return 100 - (100 / (1 + relativeStrength));
        }

        const rsi = calculateRSI(closes, 14);

        // =====================================================
        // AVERAGE VOLUME
        // =====================================================

        const averageVolume =
            movingAverage(volumes, 20);

        const currentVolume =
            volumes[volumes.length - 1];

        // =====================================================
        // UPDATE INDICATORS ON SCREEN
        // =====================================================

        setText(
            "rsi",
            rsi !== null
                ? rsi.toFixed(2)
                : "-"
        );

        setText(
            "dma20",
            dma20 !== null
                ? `₹${dma20.toFixed(2)}`
                : "-"
        );

        setText(
            "dma50",
            dma50 !== null
                ? `₹${dma50.toFixed(2)}`
                : "-"
        );

        setText(
            "dma200",
            dma200 !== null
                ? `₹${dma200.toFixed(2)}`
                : "-"
        );

        setText(
            "volume",
            currentVolume
                ? Number(currentVolume).toLocaleString("en-IN")
                : "-"
        );

        setText(
            "high52",
            result.year_high
                ? `₹${Number(result.year_high).toFixed(2)}`
                : "-"
        );

        // =====================================================
        // STOCK OVERVIEW
        // =====================================================

        setText("stockSymbol", result.symbol || stock);
        setText("stockExchange", result.exchange || "NSE");

        setText(
            "stockPrice",
            Number(price).toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })
        );

        const change = Number(result.change || 0);
        const percentChange = Number(result.percent_change || 0);

        setText(
            "stockChange",
            `${change >= 0 ? "+" : ""}${change.toFixed(2)} (${percentChange >= 0 ? "+" : ""}${percentChange.toFixed(2)}%)`
        );

        // =====================================================
        // TREND SCORE
        // Maximum 20
        // =====================================================

        let trendScore = 0;

        if (price > dma20) {
            trendScore += 5;
        }

        if (price > dma50) {
            trendScore += 5;
        }

        if (price > dma200) {
            trendScore += 5;
        }

        if (dma20 > dma50) {
            trendScore += 2.5;
        }

        if (dma50 > dma200) {
            trendScore += 2.5;
        }

        // =====================================================
        // MOMENTUM SCORE
        // Maximum 20
        // =====================================================

        let momentumScore = 0;

        const price20DaysAgo =
            closes.length > 20
                ? closes[closes.length - 21]
                : price;

        const price50DaysAgo =
            closes.length > 50
                ? closes[closes.length - 51]
                : price;

        const return20 =
            ((price - price20DaysAgo) / price20DaysAgo) * 100;

        const return50 =
            ((price - price50DaysAgo) / price50DaysAgo) * 100;

        if (return20 > 0) {
            momentumScore += 10;
        }

        if (return50 > 0) {
            momentumScore += 10;
        }

        // =====================================================
        // RSI SCORE
        // Maximum 10
        // =====================================================

        let rsiScore = 0;

        if (rsi >= 50 && rsi <= 70) {
            rsiScore = 10;
        } else if (rsi >= 40 && rsi < 50) {
            rsiScore = 7;
        } else if (rsi > 70 && rsi <= 80) {
            rsiScore = 6;
        } else if (rsi >= 30 && rsi < 40) {
            rsiScore = 4;
        } else if (rsi < 30) {
            rsiScore = 5;
        } else {
            rsiScore = 3;
        }

        // =====================================================
        // MA SCORE
        // Maximum 10
        // =====================================================

        let maScore = 0;

        if (price > dma20) {
            maScore += 3;
        }

        if (price > dma50) {
            maScore += 3;
        }

        if (price > dma200) {
            maScore += 4;
        }

        // =====================================================
        // VOLUME SCORE
        // Maximum 10
        // =====================================================

        let volumeScore = 0;

        if (currentVolume > averageVolume) {
            volumeScore = 10;
        } else {
            volumeScore = 5;
        }

        // =====================================================
        // RISK SCORE
        // Maximum 10
        // Higher = lower risk
        // =====================================================

        let riskScore = 5;

        if (price > dma200) {
            riskScore += 3;
        }

        if (rsi >= 40 && rsi <= 70) {
            riskScore += 2;
        }

        if (riskScore > 10) {
            riskScore = 10;
        }

        // =====================================================
        // VALUATION
        // TEMPORARY
        // =====================================================

        const valuationScore = 0;

        // =====================================================
        // OVERALL SCORE
        // =====================================================

        const overallScore =
            trendScore +
            momentumScore +
            rsiScore +
            maScore +
            volumeScore +
            valuationScore +
            riskScore;

        // =====================================================
        // UPDATE SCORE BREAKDOWN
        // =====================================================

        setText(
            "trendScore",
            `${trendScore.toFixed(1)} / 20`
        );

        setText(
            "momentumScore",
            `${momentumScore.toFixed(1)} / 20`
        );

        setText(
            "rsiScore",
            `${rsiScore.toFixed(1)} / 10`
        );

        setText(
            "maScore",
            `${maScore.toFixed(1)} / 10`
        );

        setText(
            "volumeScore",
            `${volumeScore.toFixed(1)} / 10`
        );

        setText(
            "valuationScore",
            `${valuationScore.toFixed(1)} / 20`
        );

        setText(
            "riskScore",
            `${riskScore.toFixed(1)} / 10`
        );

        setText(
            "score",
            Math.round(overallScore)
        );

        // =====================================================
        // SIGNAL
        // =====================================================

        let signal = "NEUTRAL";

        if (overallScore >= 75) {
            signal = "STRONG";
        } else if (overallScore >= 60) {
            signal = "POSITIVE";
        } else if (overallScore < 40) {
            signal = "WEAK";
        }

        setText("signal", signal);

        console.log("===== STOCK ANALYSIS =====");
        console.log("Price:", price);
        console.log("DMA20:", dma20);
        console.log("DMA50:", dma50);
        console.log("DMA200:", dma200);
        console.log("RSI:", rsi);
        console.log("20D Return:", return20);
        console.log("50D Return:", return50);
        console.log("Average Volume:", averageVolume);
        console.log("Overall Score:", overallScore);

    } catch (error) {

        console.error("API ERROR:", error);

        alert(
            "Stock analysis load nahi ho paaya.\n\n" +
            error.message
        );
    }
}


// =====================================================
// HELPER
// =====================================================

function setText(id, value) {

    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}
