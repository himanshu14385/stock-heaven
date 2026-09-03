async function analyzeStock() {

    const input = document.getElementById("stockInput");

    const stock = input.value
        .trim()
        .toUpperCase();

    if (!stock) {
        alert("Stock symbol enter karo");
        return;
    }

    try {

        const url =
            `/api/stock?symbol=${encodeURIComponent(stock)}`;

        const response = await fetch(url);

        const result = await response.json();

        if (!response.ok || result.error) {
            throw new Error(
                result.error || "Stock not found"
            );
        }


        const history = result.history || [];

        if (history.length < 200) {
            throw new Error(
                "200 days ka data available nahi hai"
            );
        }


        const closes = history
            .map(item => Number(item.close))
            .filter(value => !isNaN(value));


        const volumes = history
            .map(item => Number(item.volume || 0));


        const price = Number(result.price);


        /* =========================
           HELPERS
        ========================= */

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


        function calculateRSI(data, period = 14) {

            if (data.length <= period) {
                return null;
            }

            let gains = 0;
            let losses = 0;


            for (let i = 1; i <= period; i++) {

                const change =
                    data[i] - data[i - 1];

                if (change > 0) {
                    gains += change;
                } else {
                    losses += Math.abs(change);
                }
            }


            let averageGain = gains / period;
            let averageLoss = losses / period;


            for (
                let i = period + 1;
                i < data.length;
                i++
            ) {

                const change =
                    data[i] - data[i - 1];

                const gain =
                    change > 0 ? change : 0;

                const loss =
                    change < 0
                        ? Math.abs(change)
                        : 0;


                averageGain =
                    (
                        averageGain * (period - 1)
                        + gain
                    ) / period;


                averageLoss =
                    (
                        averageLoss * (period - 1)
                        + loss
                    ) / period;
            }


            if (averageLoss === 0) {
                return 100;
            }


            const rs =
                averageGain / averageLoss;


            return 100 - (
                100 / (1 + rs)
            );
        }


        function setText(id, value) {

            const element =
                document.getElementById(id);

            if (element) {
                element.textContent = value;
            }
        }


        function money(value) {

            if (
                value === null ||
                value === undefined ||
                isNaN(value)
            ) {
                return "--";
            }

            return `₹${Number(value).toLocaleString(
                "en-IN",
                {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }
            )}`;
        }


        function number(value) {

            if (
                value === null ||
                value === undefined ||
                isNaN(value)
            ) {
                return "--";
            }

            return Number(value)
                .toLocaleString("en-IN");
        }


        /* =========================
           CALCULATIONS
        ========================= */

        const dma20 =
            movingAverage(closes, 20);

        const dma50 =
            movingAverage(closes, 50);

        const dma200 =
            movingAverage(closes, 200);


        const rsi =
            calculateRSI(closes, 14);


        const averageVolume =
            movingAverage(volumes, 20);


        const currentVolume =
            volumes[volumes.length - 1];


        const price20DaysAgo =
            closes[closes.length - 21];


        const price50DaysAgo =
            closes[closes.length - 51];


        const return20 =
            (
                (price - price20DaysAgo)
                / price20DaysAgo
            ) * 100;


        const return50 =
            (
                (price - price50DaysAgo)
                / price50DaysAgo
            ) * 100;


        const volumeRatio =
            averageVolume > 0
                ? (
                    currentVolume /
                    averageVolume
                ) * 100
                : 0;


        const nearHigh =
            result.year_high
                ? (
                    (result.year_high - price)
                    / result.year_high
                ) * 100
                : null;


        const fromLow =
            result.year_low
                ? (
                    (price - result.year_low)
                    / result.year_low
                ) * 100
                : null;


        /* =========================
           BASIC OVERVIEW
        ========================= */

        setText(
            "stockSymbol",
            result.symbol || stock
        );


        setText(
            "stockExchange",
            result.exchange || "NSE"
        );


        setText(
            "companyName",
            result.company_name ||
            result.symbol ||
            stock
        );


        setText(
            "stockPrice",
            money(price)
        );


        const change =
            Number(result.change || 0);

        const percentChange =
            Number(result.percent_change || 0);


        const changeElement =
            document.getElementById(
                "stockChange"
            );


        if (changeElement) {

            changeElement.textContent =
                `${change >= 0 ? "+" : ""}` +
                `${change.toFixed(2)} ` +
                `(${percentChange >= 0 ? "+" : ""}` +
                `${percentChange.toFixed(2)}%)`;

            changeElement.style.color =
                change >= 0
                    ? "#15934a"
                    : "#e04d4d";
        }


        const last =
            history[history.length - 1];


        setText(
            "openPrice",
            money(last.open)
        );


        setText(
            "dayHigh",
            money(last.high)
        );


        setText(
            "dayLow",
            money(last.low)
        );


        setText(
            "previousClose",
            money(result.previous_close)
        );


        setText(
            "volumeTop",
            number(currentVolume)
        );


        setText(
            "high52Top",
            money(result.year_high)
        );


        setText(
            "low52Top",
            money(result.year_low)
        );


        setText(
            "currency",
            result.currency || "INR"
        );


        /* =========================
           HIGHLIGHTS
        ========================= */

        setText(
            "nearHigh",
            nearHigh !== null
                ? `${nearHigh.toFixed(2)}% below`
                : "--"
        );


        setText(
            "fromLow",
            fromLow !== null
                ? `${fromLow.toFixed(2)}% above`
                : "--"
        );


        setText(
            "avgVolume",
            number(averageVolume)
        );


        setText(
            "currentVolume",
            number(currentVolume)
        );


        setText(
            "volumeVsAverage",
            averageVolume > 0
                ? `${volumeRatio.toFixed(2)}%`
                : "--"
        );


        /* =========================
           TECHNICAL INDICATORS
        ========================= */

        setText(
            "rsi",
            rsi !== null
                ? rsi.toFixed(2)
                : "--"
        );


        setText(
            "dma20",
            money(dma20)
        );


        setText(
            "dma50",
            money(dma50)
        );


        setText(
            "dma200",
            money(dma200)
        );


        setText(
            "volume",
            number(currentVolume)
        );


        setText(
            "high52",
            money(result.year_high)
        );


        /* STATUS */

        setText(
            "rsiStatus",
            rsi >= 70
                ? "Overbought"
                : rsi >= 50
                    ? "Healthy"
                    : rsi >= 30
                        ? "Weak"
                        : "Oversold"
        );


        setText(
            "dma20Status",
            price > dma20
                ? "Price above"
                : "Price below"
        );


        setText(
            "dma50Status",
            price > dma50
                ? "Price above"
                : "Price below"
        );


        setText(
            "dma200Status",
            price > dma200
                ? "Price above"
                : "Price below"
        );


        setText(
            "volumeStatus",
            currentVolume > averageVolume
                ? "Above Avg"
                : "Below Avg"
        );


        setText(
            "high52Status",
            nearHigh !== null
                ? `${nearHigh.toFixed(1)}% below`
                : "--"
        );


        /* =========================
           SCORE
        ========================= */

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


        let momentumScore = 0;


        if (return20 > 0) {
            momentumScore += 10;
        }

        if (return50 > 0) {
            momentumScore += 10;
        }


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


        /* MA SCORE = 15 */

        let maScore = 0;


        if (price > dma20) {
            maScore += 5;
        }

        if (price > dma50) {
            maScore += 5;
        }

        if (price > dma200) {
            maScore += 5;
        }


        /* VOLUME = 10 */

        let volumeScore = 5;


        if (
            currentVolume >
            averageVolume
        ) {
            volumeScore = 10;
        }


        /* RISK = 10 */

        let riskScore = 5;


        if (price > dma200) {
            riskScore += 3;
        }


        if (
            rsi >= 40 &&
            rsi <= 70
        ) {
            riskScore += 2;
        }


        if (riskScore > 10) {
            riskScore = 10;
        }


        /*
            Valuation currently unavailable.

            Total available score = 85

            Trend       20
            Momentum    20
            RSI         10
            MA          15
            Volume      10
            Risk        10
        */

        const totalScore =
            trendScore +
            momentumScore +
            rsiScore +
            maScore +
            volumeScore +
            riskScore;


        const normalizedScore =
            (totalScore / 85) * 100;


        /* =========================
           DISPLAY SCORE
        ========================= */

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
            `${maScore.toFixed(1)} / 15`
        );


        setText(
            "volumeScore",
            `${volumeScore.toFixed(1)} / 10`
        );


        setText(
            "riskScore",
            `${riskScore.toFixed(1)} / 10`
        );


        setText(
            "totalScore",
            `${totalScore.toFixed(1)} / 85`
        );


        setText(
            "score",
            Math.round(normalizedScore)
        );


        /* SCORE BARS */

        setBar(
            "trendBar",
            trendScore / 20 * 100
        );

        setBar(
            "momentumBar",
            momentumScore / 20 * 100
        );

        setBar(
            "rsiBar",
            rsiScore / 10 * 100
        );

        setBar(
            "maBar",
            maScore / 15 * 100
        );

        setBar(
            "volumeBar",
            volumeScore / 10 * 100
        );

        setBar(
            "riskBar",
            riskScore / 10 * 100
        );


        /* SCORE RING */

        updateScoreRing(
            normalizedScore
        );


        /* =========================
           SIGNAL
        ========================= */

        let signal =
            "NEUTRAL";

        let signalClass =
            "neutral";


        if (normalizedScore >= 75) {

            signal = "STRONG";
            signalClass = "strong";

        } else if (normalizedScore >= 60) {

            signal = "POSITIVE";
            signalClass = "positive";

        } else if (normalizedScore < 40) {

            signal = "WEAK";
            signalClass = "weak";
        }


        const signalElement =
            document.getElementById(
                "signal"
            );


        signalElement.textContent =
            signal;

        signalElement.className =
            `signal ${signalClass}`;


        /* DESCRIPTION */

        let description =
            "Technical conditions are mixed.";


        if (normalizedScore >= 75) {

            description =
                "Strong technical setup with positive trend and momentum.";

        } else if (normalizedScore >= 60) {

            description =
                "Positive technical structure with reasonably healthy momentum.";

        } else if (normalizedScore < 40) {

            description =
                "Technical structure is weak and requires caution.";
        }


        setText(
            "scoreDescription",
            description
        );


        /* =========================
           INSIGHTS
        ========================= */

        generateInsights(
            price,
            dma20,
            dma50,
            dma200,
            rsi,
            currentVolume,
            averageVolume,
            nearHigh
        );


        /* =========================
           OUR TAKE
        ========================= */

        let take =
            "Technical indicators are currently mixed.";

        let badge =
            "WATCH";


        if (
            price > dma20 &&
            price > dma50 &&
            price > dma200
        ) {

            take =
                "Price is above the 20, 50 and 200 DMA, indicating a strong bullish technical trend.";

            badge =
                "KEEP ON WATCH";

        } else if (
            price < dma200
        ) {

            take =
                "Price is below the 200 DMA, suggesting weaker long-term technical strength.";

            badge =
                "CAUTION";

        } else if (
            rsi < 40
        ) {

            take =
                "RSI is relatively weak. Momentum should be monitored before taking a position.";

            badge =
                "WATCH";

        }


        setText(
            "ourTake",
            take
        );


        setText(
            "takeBadge",
            badge
        );


        console.log(
            "===== STOCK ANALYSIS ====="
        );

        console.log(
            "Stock:",
            stock
        );

        console.log(
            "Price:",
            price
        );

        console.log(
            "RSI:",
            rsi
        );

        console.log(
            "DMA20:",
            dma20
        );

        console.log(
            "DMA50:",
            dma50
        );

        console.log(
            "DMA200:",
            dma200
        );

        console.log(
            "Score:",
            normalizedScore
        );


    } catch (error) {

        console.error(
            "API ERROR:",
            error
        );

        alert(
            "Stock analysis load nahi ho paaya.\n\n" +
            error.message
        );
    }
}


/* =========================
   SCORE BAR
========================= */

function setBar(id, percentage) {

    const element =
        document.getElementById(id);

    if (!element) {
        return;
    }

    element.style.width =
        `${Math.max(
            0,
            Math.min(100, percentage)
        )}%`;
}


/* =========================
   SCORE RING
========================= */

function updateScoreRing(score) {

    const circle =
        document.getElementById(
            "scoreProgress"
        );

    if (!circle) {
        return;
    }

    const circumference =
        2 * Math.PI * 78;

    const offset =
        circumference -
        (
            score / 100
        ) * circumference;


    circle.style.strokeDasharray =
        circumference;

    circle.style.strokeDashoffset =
        offset;


    if (score >= 75) {

        circle.style.stroke =
            "#21a45b";

    } else if (score >= 60) {

        circle.style.stroke =
            "#3475e8";

    } else if (score < 40) {

        circle.style.stroke =
            "#e85252";

    } else {

        circle.style.stroke =
            "#ed9b18";
    }
}


/* =========================
   INSIGHTS
========================= */

function generateInsights(
    price,
    dma20,
    dma50,
    dma200,
    rsi,
    volume,
    averageVolume,
    nearHigh
) {

    const container =
        document.getElementById(
            "insights"
        );


    let html = "";


    if (
        price > dma20 &&
        price > dma50 &&
        price > dma200
    ) {

        html += `
            <div class="insight">

                <div class="insight-icon green">
                    <i class="fa-solid fa-arrow-trend-up"></i>
                </div>

                <div>
                    <strong>Price is above 20, 50 & 200 DMA</strong>
                    <span>Strong bullish trend</span>
                </div>

            </div>
        `;

    } else {

        html += `
            <div class="insight">

                <div class="insight-icon orange">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                </div>

                <div>
                    <strong>Price is below some moving averages</strong>
                    <span>Trend needs monitoring</span>
                </div>

            </div>
        `;
    }


    if (
        rsi >= 50 &&
        rsi <= 70
    ) {

        html += `
            <div class="insight">

                <div class="insight-icon green">
                    <i class="fa-solid fa-heart-pulse"></i>
                </div>

                <div>
                    <strong>RSI is in healthy zone</strong>
                    <span>Momentum looks balanced</span>
                </div>

            </div>
        `;

    } else if (rsi > 70) {

        html += `
            <div class="insight">

                <div class="insight-icon orange">
                    <i class="fa-solid fa-fire"></i>
                </div>

                <div>
                    <strong>RSI indicates overbought zone</strong>
                    <span>Short-term caution required</span>
                </div>

            </div>
        `;

    } else {

        html += `
            <div class="insight">

                <div class="insight-icon red">
                    <i class="fa-solid fa-arrow-down"></i>
                </div>

                <div>
                    <strong>RSI is relatively weak</strong>
                    <span>Momentum needs improvement</span>
                </div>

            </div>
        `;
    }


    if (
        volume >
        averageVolume
    ) {

        html += `
            <div class="insight">

                <div class="insight-icon blue">
                    <i class="fa-solid fa-chart-column"></i>
                </div>

                <div>
                    <strong>Volume is above average</strong>
                    <span>Higher market participation</span>
                </div>

            </div>
        `;

    } else {

        html += `
            <div class="insight">

                <div class="insight-icon blue">
                    <i class="fa-solid fa-chart-column"></i>
                </div>

                <div>
                    <strong>Volume is below average</strong>
                    <span>Participation is relatively low</span>
                </div>

            </div>
        `;
    }


    if (
        nearHigh !== null &&
        nearHigh < 10
    ) {

        html += `
            <div class="insight">

                <div class="insight-icon orange">
                    <i class="fa-solid fa-bullseye"></i>
                </div>

                <div>
                    <strong>Price is near 52W High</strong>
                    <span>Possible resistance zone</span>
                </div>

            </div>
        `;
    }


    container.innerHTML =
        html;
}


/* =========================
   ENTER KEY
========================= */

function handleSearch(event) {

    if (event.key === "Enter") {
        analyzeStock();
    }
}


/* =========================
   STOCK SEARCH DATABASE
========================= */

const stockList = [

    ["RELIANCE", "Reliance Industries Limited"],
    ["TCS", "Tata Consultancy Services Limited"],
    ["HDFCBANK", "HDFC Bank Limited"],
    ["INFY", "Infosys Limited"],
    ["ICICIBANK", "ICICI Bank Limited"],
    ["BHARTIARTL", "Bharti Airtel Limited"],
    ["SBIN", "State Bank of India"],
    ["ITC", "ITC Limited"],
    ["HINDUNILVR", "Hindustan Unilever Limited"],
    ["LT", "Larsen & Toubro Limited"],
    ["MARUTI", "Maruti Suzuki India Limited"],
    ["BAJFINANCE", "Bajaj Finance Limited"],
    ["TITAN", "Titan Company Limited"],
    ["ASIANPAINT", "Asian Paints Limited"],
    ["AXISBANK", "Axis Bank Limited"],
    ["KOTAKBANK", "Kotak Mahindra Bank Limited"],
    ["HCLTECH", "HCL Technologies Limited"],
    ["WIPRO", "Wipro Limited"],
    ["SUNPHARMA", "Sun Pharmaceutical Industries Limited"],
    ["NTPC", "NTPC Limited"],
    ["POWERGRID", "Power Grid Corporation of India Limited"],
    ["ONGC", "Oil & Natural Gas Corporation Limited"],
    ["COALINDIA", "Coal India Limited"],
    ["TATASTEEL", "Tata Steel Limited"],
    ["JSWSTEEL", "JSW Steel Limited"],
    ["ADANIENT", "Adani Enterprises Limited"],
    ["ADANIPORTS", "Adani Ports and Special Economic Zone Limited"],
    ["ADANIPOWER", "Adani Power Limited"],
    ["BEL", "Bharat Electronics Limited"],
    ["HAL", "Hindustan Aeronautics Limited"],
    ["TRENT", "Trent Limited"],
    ["M&M", "Mahindra & Mahindra Limited"],
    ["EICHERMOT", "Eicher Motors Limited"],
    ["HEROMOTOCO", "Hero MotoCorp Limited"],
    ["BAJAJ-AUTO", "Bajaj Auto Limited"],
    ["BAJAJFINSV", "Bajaj Finserv Limited"],
    ["INDUSINDBK", "IndusInd Bank Limited"],
    ["GRASIM", "Grasim Industries Limited"],
    ["ULTRACEMCO", "UltraTech Cement Limited"],
    ["CIPLA", "Cipla Limited"],
    ["DRREDDY", "Dr. Reddy's Laboratories Limited"],
    ["DIVISLAB", "Divi's Laboratories Limited"],
    ["APOLLOHOSP", "Apollo Hospitals Enterprise Limited"],
    ["TATAMOTORS", "Tata Motors Limited"],
    ["TATACONSUM", "Tata Consumer Products Limited"],
    ["TATAPOWER", "Tata Power Company Limited"],
    ["IOC", "Indian Oil Corporation Limited"],
    ["BPCL", "Bharat Petroleum Corporation Limited"],
    ["GAIL", "GAIL (India) Limited"],
    ["VEDL", "Vedanta Limited"],
    ["HINDALCO", "Hindalco Industries Limited"],
    ["SHRIRAMFIN", "Shriram Finance Limited"],
    ["SBILIFE", "SBI Life Insurance Company Limited"],
    ["HDFCLIFE", "HDFC Life Insurance Company Limited"],
    ["ICICIPRULI", "ICICI Prudential Life Insurance Company Limited"],
    ["DMART", "Avenue Supermarts Limited"],
    ["PIDILITIND", "Pidilite Industries Limited"],
    ["DABUR", "Dabur India Limited"],
    ["BRITANNIA", "Britannia Industries Limited"],
    ["NESTLEIND", "Nestle India Limited"],
    ["GODREJCP", "Godrej Consumer Products Limited"],
    ["COLPAL", "Colgate-Palmolive (India) Limited"],
    ["HAVELLS", "Havells India Limited"],
    ["VOLTAS", "Voltas Limited"],
    ["DIXON", "Dixon Technologies (India) Limited"],
    ["POLYCAB", "Polycab India Limited"],
    ["IRCTC", "Indian Railway Catering & Tourism Corporation Limited"],
    ["IRFC", "Indian Railway Finance Corporation Limited"],
    ["RVNL", "Rail Vikas Nigam Limited"],
    ["RECLTD", "REC Limited"],
    ["PFC", "Power Finance Corporation Limited"],
    ["NHPC", "NHPC Limited"],
    ["IEX", "Indian Energy Exchange Limited"],
    ["ZOMATO", "Eternal Limited"],
    ["PAYTM", "One 97 Communications Limited"],
    ["NYKAA", "FSN E-Commerce Ventures Limited"],
    ["DELHIVERY", "Delhivery Limited"],
    ["INDIGO", "InterGlobe Aviation Limited"],
    ["DLF", "DLF Limited"],
    ["LODHA", "Macrotech Developers Limited"],
    ["SIEMENS", "Siemens Limited"],
    ["ABB", "ABB India Limited"],
    ["CUMMINSIND", "Cummins India Limited"],
    ["BOSCHLTD", "Bosch Limited"],
    ["TVSMOTOR", "TVS Motor Company Limited"],
    ["MOTHERSON", "Samvardhana Motherson International Limited"],
    ["ASHOKLEY", "Ashok Leyland Limited"],
    ["BHEL", "Bharat Heavy Electricals Limited"],
    ["INDUSTOWER", "Indus Towers Limited"],
    ["YESBANK", "Yes Bank Limited"],
    ["BANKBARODA", "Bank of Baroda"],
    ["PNB", "Punjab National Bank"],
    ["CANBK", "Canara Bank"],
    ["IDFCFIRSTB", "IDFC First Bank Limited"],
    ["FEDERALBNK", "The Federal Bank Limited"],
    ["RECLTD", "REC Limited"],
    ["TECHM", "Tech Mahindra Limited"],
    ["LTIM", "LTIMindtree Limited"],
    ["JIOFIN", "Jio Financial Services Limited"],
    ["AMBUJACEM", "Ambuja Cements Limited"],
    ["SHREECEM", "Shree Cement Limited"],
    ["CHOLAFIN", "Cholamandalam Investment and Finance Company Limited"],
    ["UPL", "UPL Limited"],
    ["ADANIGREEN", "Adani Green Energy Limited"],
    ["ADANIENSOL", "Adani Energy Solutions Limited"],
    ["HDFCAMC", "HDFC Asset Management Company Limited"],
    ["ICICIGI", "ICICI Lombard General Insurance Company Limited"],
    ["JINDALSTEL", "Jindal Steel & Power Limited"],
    ["MARICO", "Marico Limited"],
    ["MUTHOOTFIN", "Muthoot Finance Limited"],
    ["NAUKRI", "Info Edge (India) Limited"],
    ["PIIND", "PI Industries Limited"],
    ["MCDOWELL-N", "United Spirits Limited"],
    ["BAJAJHLDNG", "Bajaj Holdings & Investment Limited"],
    ["BERGEPAINT", "Berger Paints India Limited"],
    ["SBICARD", "SBI Cards and Payment Services Limited"],
    ["SRF", "SRF Limited"],
    ["TORNTPHARM", "Torrent Pharmaceuticals Limited"],
    ["MAXHEALTH", "Max Healthcare Institute Limited"],
    ["CGPOWER", "CG Power and Industrial Solutions Limited"]
];


/* =========================
   SHOW SUGGESTIONS
========================= */

function showStockSuggestions() {

    const input =
        document.getElementById(
            "stockInput"
        );

    const container =
        document.getElementById(
            "stockSuggestions"
        );


    const query =
        input.value
            .trim()
            .toUpperCase();


    if (!query) {

        container.style.display =
            "none";

        container.innerHTML = "";

        return;
    }


    const matches =
        stockList
            .filter(stock => {

                const symbol =
                    stock[0].toUpperCase();

                const name =
                    stock[1].toUpperCase();


                return (
                    symbol.includes(query) ||
                    name.includes(query)
                );

            })
            .slice(0, 7);


    if (!matches.length) {

        container.style.display =
            "none";

        container.innerHTML = "";

        return;
    }


    container.innerHTML =
        matches.map(stock => {

            const symbol =
                stock[0];

            const name =
                stock[1];


            return `
                <div
                    class="stock-suggestion"
                    onclick="selectStock('${symbol}')"
                >

                    <div class="suggestion-icon">
                        <i class="fa-solid fa-chart-line"></i>
                    </div>

                    <div class="suggestion-info">

                        <span class="suggestion-name">
                            ${name}
                        </span>

                        <span class="suggestion-symbol">
                            NSE ·
                            <strong>${symbol}</strong>
                        </span>

                    </div>

                </div>
            `;

        }).join("");


    container.style.display =
        "block";
}


/* =========================
   SELECT SUGGESTION
========================= */

function selectStock(symbol) {

    const input =
        document.getElementById(
            "stockInput"
        );

    const container =
        document.getElementById(
            "stockSuggestions"
        );


    input.value = symbol;

    container.style.display =
        "none";

    container.innerHTML = "";


    analyzeStock();
}


/* =========================
   CLOSE SUGGESTIONS
========================= */

document.addEventListener(
    "click",
    function(event) {

        const wrapper =
            document.querySelector(
                ".search-wrapper"
            );


        if (
            wrapper &&
            !wrapper.contains(event.target)
        ) {

            const container =
                document.getElementById(
                    "stockSuggestions"
                );

            container.style.display =
                "none";
        }

    }
);

function quickSelectStock(symbol) {

    const input = document.getElementById("stockInput");
    const suggestions = document.getElementById("stockSuggestions");

    if (input) {
        input.value = symbol;
    }

    if (suggestions) {
        suggestions.style.display = "none";
        suggestions.innerHTML = "";
    }

    analyzeStock();
}
