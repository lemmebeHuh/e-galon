document.addEventListener('DOMContentLoaded', () => {
    const ordersList = document.getElementById('admin-orders-list');
    let channel;

    if ('BroadcastChannel' in window) {
        channel = new BroadcastChannel('galon-notif');
        channel.onmessage = (event) => {
            if (event.data && event.data.type === 'new-order') {
                loadAdminOrders();
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('Pesanan Baru Masuk!', { 
                        body: `${event.data.order.quantity} Galon - ${event.data.order.address}`,
                        icon: './assets/icon-192.png'
                    });
                }
            }
        };
    }

    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    function loadAdminOrders() {
        const orders = JSON.parse(localStorage.getItem('galon_orders')) || [];
        ordersList.innerHTML = '';

        if (orders.length === 0) {
            ordersList.innerHTML = '<p class="empty-state">Belum ada pesanan masuk.</p>';
            return;
        }

        // Sort: pending first, then otw, then completed (and by timestamp)
        orders.sort((a,b) => {
            const statusOrder = { 'pending': 1, 'otw': 2, 'completed': 3 };
            if (statusOrder[a.status] !== statusOrder[b.status]) {
                return statusOrder[a.status] - statusOrder[b.status];
            }
            return b.timestamp - a.timestamp;
        }).forEach(order => {
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
                
                ${order.status !== 'completed' ? `
                <div class="admin-actions">
                    ${order.status === 'pending' ? `<button class="btn-action btn-send" data-id="${order.id}">🚚 Kirim</button>` : ''}
                    ${order.status === 'otw' ? `<button class="btn-action btn-done" data-id="${order.id}">✅ Tiba</button>` : ''}
                </div>
                ` : ''}
            `;
            ordersList.appendChild(el);
        });

        attachActionListeners();
    }

    function attachActionListeners() {
        const btnSends = document.querySelectorAll('.btn-send');
        const btnDones = document.querySelectorAll('.btn-done');

        btnSends.forEach(btn => btn.addEventListener('click', (e) => updateStatus(e.target.dataset.id, 'otw')));
        btnDones.forEach(btn => btn.addEventListener('click', (e) => updateStatus(e.target.dataset.id, 'completed')));
    }

    function updateStatus(orderId, newStatus) {
        let orders = JSON.parse(localStorage.getItem('galon_orders')) || [];
        const orderIndex = orders.findIndex(o => o.id === orderId);
        
        if (orderIndex > -1) {
            orders[orderIndex].status = newStatus;
            localStorage.setItem('galon_orders', JSON.stringify(orders));
            
            // Re-render
            loadAdminOrders();

            // Notify user
            if (channel) {
                channel.postMessage({
                    type: 'status-update',
                    status: newStatus,
                    address: orders[orderIndex].address
                });
            }
        }
    }

    loadAdminOrders();
});
