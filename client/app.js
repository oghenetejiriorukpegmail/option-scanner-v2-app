document.addEventListener('DOMContentLoaded', () => {
    const scannerForm = document.getElementById('scanner-form');
    const resultsContainer = document.getElementById('results-container');

    if (scannerForm) {
        scannerForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // Prevent default form submission

            const setupType = document.getElementById('setup-type').value;
            const symbolsInput = document.getElementById('symbols').value;
            const symbols = symbolsInput.split(',').map(s => s.trim()).filter(s => s); // Clean up input

            if (symbols.length === 0) {
                resultsContainer.innerHTML = '<p style="color: red;">Please enter at least one stock symbol.</p>';
                return;
            }

            console.log(`Scanning symbols: ${symbols.join(', ')} for setup type: ${setupType}`);
            resultsContainer.innerHTML = '<p>Scanning...</p>'; // Update UI

            // Construct API URL
            // Use relative URL assuming client and server are served from the same origin in production,
            // or use full URL with port 3001 for local development if served separately.
            // For simplicity in dev with http-server, we'll use the full URL.
            const apiUrl = new URL('http://localhost:3001/api/scan');
            apiUrl.searchParams.append('symbols', symbols.join(','));
            apiUrl.searchParams.append('setupType', setupType);
            // TODO: Add other filter parameters from the form later

            try {
                const response = await fetch(apiUrl);

                if (!response.ok) {
                    // Try to parse error details from backend response body
                    let errorDetails = `HTTP error! status: ${response.status}`;
                    try {
                        const errorData = await response.json();
                        errorDetails = errorData.error || errorData.message || errorDetails;
                        if (errorData.details) {
                            errorDetails += ` (${errorData.details})`;
                        }
                    } catch (e) {
                        // Ignore if response body is not JSON or empty
                    }
                    throw new Error(errorDetails);
                }

                const data = await response.json();
                console.log('API Response:', data);

                // Display results
                let resultsHtml = '<h3>Scan Results</h3>';

                if (data.errors && data.errors.length > 0) {
                    resultsHtml += '<h4>Errors:</h4><ul>';
                    data.errors.forEach(err => {
                        resultsHtml += `<li style="color: orange;">${err.symbol ? `Symbol ${err.symbol}: ` : ''}${err.message}</li>`;
                    });
                    resultsHtml += '</ul>';
                }

                if (data.matches && data.matches.length > 0) {
                    resultsHtml += '<h4>Matches:</h4><table>';
                    resultsHtml += '<thead><tr><th>Symbol</th><th>EMA10</th><th>EMA20</th><th>EMA50</th><th>RSI</th><th>StochK</th></tr></thead>';
                    resultsHtml += '<tbody>';
                    data.matches.forEach(match => {
                        resultsHtml += `<tr>
                            <td>${match.symbol}</td>
                            <td>${match.ema10?.toFixed(2) ?? 'N/A'}</td>
                            <td>${match.ema20?.toFixed(2) ?? 'N/A'}</td>
                            <td>${match.ema50?.toFixed(2) ?? 'N/A'}</td>
                            <td>${match.rsi?.toFixed(2) ?? 'N/A'}</td>
                            <td>${match.stochK?.toFixed(2) ?? 'N/A'}</td>
                        </tr>`;
                    });
                    resultsHtml += '</tbody></table>';
                } else {
                    resultsHtml += '<p>No matching symbols found for the selected criteria.</p>';
                }

                resultsContainer.innerHTML = resultsHtml;

            } catch (error) {
                console.error('Error during scan fetch:', error);
                resultsContainer.innerHTML = `<p style="color: red;">Error during scan: ${error.message}</p>`;
            }
        });
    } else {
        console.error('Scanner form not found.');
    }
});