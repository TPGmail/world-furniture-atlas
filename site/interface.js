/* Furniverse interface enhancements only. No note or cloud data writes. */
(() => {
    'use strict';

    const directory = document.getElementById('atlas-customer-pane');
    const controls = directory && directory.querySelector('.customer-osm-controls');
    const toggle = document.getElementById('customer-directory-toggle');
    const content = document.getElementById('customer-directory-body');

    if (controls && toggle && content) {
        const mq = window.matchMedia('(max-width: 900px)');
        let chosenByUser = false;

        function setCollapsed(collapsed) {
            controls.classList.toggle('is-collapsed', collapsed);
            toggle.setAttribute('aria-expanded', String(!collapsed));
            toggle.textContent = collapsed ? 'Mở danh sách' : 'Thu gọn';
            toggle.title = collapsed ? 'Mở danh sách khách hàng' : 'Thu gọn để xem bản đồ';
        }
        setCollapsed(mq.matches);
        toggle.addEventListener('click', () => {
            chosenByUser = true;
            setCollapsed(!controls.classList.contains('is-collapsed'));
        });
        if (typeof mq.addEventListener === 'function') {
            mq.addEventListener('change', event => {
                if (!chosenByUser) setCollapsed(event.matches);
            });
        }
    }

    const cloudStatus = document.getElementById('cloud-status');
    const headerStatus = document.getElementById('header-sync-status');
    const headerBadge = headerStatus && headerStatus.closest('.header-sync');
    if (cloudStatus && headerStatus && headerBadge) {
        function renderCloudStatus() {
            const message = cloudStatus.textContent.trim() || 'Chưa kết nối';
            headerStatus.textContent = 'Drive · ' + message;
            headerBadge.dataset.state = cloudStatus.dataset.state || 'offline';
        }
        renderCloudStatus();
        new MutationObserver(renderCloudStatus).observe(cloudStatus, {
            childList: true, characterData: true, attributes: true, attributeFilter: ['data-state'], subtree: true
        });
    }
})();
