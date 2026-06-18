document.addEventListener('DOMContentLoaded', () => {
    const quantityEl = document.getElementById('quantity');
    const addressEl = document.getElementById('address');
    const btnIncrease = document.getElementById('btn-increase');
    const btnDecrease = document.getElementById('btn-decrease');
    const btnOrder = document.getElementById('btn-order');
    const btnOrderAgain = document.getElementById('btn-order-again');
    const productSection = document.getElementById('product-section');
    const statusMessage = document.getElementById('status-message');
    const historyList = document.getElementById('history-list');

    let quantity = 1;
    let channel;

    // Load History
    function loadHistory() {
        const orders = JSON.parse(localStorage.getItem('galon_orders')) || [];
        historyList.innerHTML = '';
        
        if (orders.length === 0) {
            historyList.innerHTML = '<p class="empty-state">Belum ada pesanan.</p>';
            return;
        }

        // Sort by newest
        orders.sort((a,b) => b.timestamp - a.timestamp).forEach(order => {
            const el = document.createElement('div');
            el.className = 'order-item';
            
            let badgeClass = 'pending';
            let statusText = 'Menunggu';
            if (order.status === 'otw') { badgeClass = 'otw'; statusText = 'Sedang Dikirim'; }
            else if (order.status === 'completed') { badgeClass = 'completed'; statusText = 'Selesai'; }

            el.innerHTML = `
                <div class="order-header">
                    <span class="order-id">#${order.id.substring(0,8)}</span>
                    <span class="order-date">${new Date(order.timestamp).toLocaleString('id-ID')}</span>
                </div>
                <div class="order-details">
                    <div><strong>${order.quantity} Galon</strong></div>
                    <div class="order-address">📍 ${order.address}</div>
                </div>
                <div><span class="badge ${badgeClass}">${statusText}</span></div>
            `;
            historyList.appendChild(el);
        });
    }

    loadHistory();

    // BroadcastChannel Logic
    if ('BroadcastChannel' in window) {
        channel = new BroadcastChannel('galon-notif');
        channel.onmessage = (event) => {
            if (event.data && event.data.type === 'status-update') {
                // Refresh UI
                loadHistory();
                
                // Show Push Notification
                let title = 'Update Pesanan';
                let body = 'Status pesanan Anda telah diperbarui.';
                if (event.data.status === 'otw') {
                    title = 'Pesanan Dikirim! 🚚';
                    body = `Pesanan galon Anda sedang dalam perjalanan menuju ${event.data.address}.`;
                } else if (event.data.status === 'completed') {
                    title = 'Pesanan Tiba! ✅';
                    body = `Galon Anda telah sampai di lokasi. Terima kasih!`;
                }
                showNotification(title, body);
            }
        };
    }

    // Register SW
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').catch(err => console.error(err));
        });
    }

    // Notification Permission
    function requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    function showNotification(title, body) {
        if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
            navigator.serviceWorker.ready.then(reg => {
                reg.showNotification(title, { body: body, icon: './assets/icon-192.png' });
            });
        }
    }

    // Button Listeners
    btnOrder.addEventListener('click', () => {
        const address = addressEl.value.trim();
        if (!address) {
            alert('Harap isi alamat pengiriman!');
            addressEl.focus();
            return;
        }

        requestNotificationPermission();

        btnOrder.textContent = 'Memproses...';
        btnOrder.disabled = true;

        setTimeout(() => {
            const newOrder = {
                id: Date.now().toString() + Math.floor(Math.random()*1000),
                quantity: quantity,
                address: address,
                status: 'pending',
                timestamp: Date.now()
            };

            // Save to DB (localStorage)
            const orders = JSON.parse(localStorage.getItem('galon_orders')) || [];
            orders.push(newOrder);
            localStorage.setItem('galon_orders', JSON.stringify(orders));

            // Update UI
            productSection.classList.add('hidden');
            statusMessage.classList.remove('hidden');
            btnOrder.textContent = 'Pesan Sekarang';
            btnOrder.disabled = false;
            addressEl.value = '';
            quantity = 1;
            quantityEl.textContent = quantity;

            loadHistory();

            // Broadcast to Admin
            if (channel) {
                channel.postMessage({ type: 'new-order', order: newOrder });
            }

            showNotification('Pesanan Berhasil! 🎉', 'Pesanan masuk ke antrean dan segera diproses admin.');
        }, 1000);
    });

    btnIncrease.addEventListener('click', () => { if (quantity < 10) { quantity++; quantityEl.textContent = quantity; } });
    btnDecrease.addEventListener('click', () => { if (quantity > 1) { quantity--; quantityEl.textContent = quantity; } });
    btnOrderAgain.addEventListener('click', () => { statusMessage.classList.add('hidden'); productSection.classList.remove('hidden'); });
});
