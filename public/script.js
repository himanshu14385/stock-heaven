async function analyzeStock() {

    const stock = document.getElementById("stockInput").value
        .trim()
        .toUpperCase();

    if (!stock) {
        alert("Stock symbol enter karo");
        return;
    }

    try {

        const url = `http://65.0.104.9/stock?symbol=${stock}&res=num`;

        const response = await fetch(url);

        console.log("Response status:", response.status);

        const result = await response.json();

        console.log("API RESULT:", result);

        if (result.status !== "success") {
            throw new Error("Stock not found");
        }

        const data = result.data;

        document.getElementById("stockSymbol").textContent =
            data.company_name || stock;

        document.getElementById("stockPrice").textContent =
            Number(data.last_price).toLocaleString("en-IN");

        document.getElementById("stockChange").textContent =
            `${data.percent_change}%`;

        alert(
            `API Working!\n\n` +
            `${data.company_name}\n` +
            `Price: ₹${data.last_price}\n` +
            `Change: ${data.percent_change}%`
        );

    } catch (error) {

        console.error("API ERROR:", error);

        alert(
            "API browser se access nahi ho pa rahi.\n\n" +
            "F12 → Console mein error check karo."
        );
    }
}
