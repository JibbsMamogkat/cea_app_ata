document.addEventListener('DOMContentLoaded', () => {
    // ====================================================================
    // 1. GLOBAL DOM ELEMENTS & STATE VARIABLES (MUST BE AT THE TOP!)
    // ====================================================================
    const canvas = document.getElementById('vipSignatureCanvas');
    const mainCtx = canvas ? canvas.getContext('2d') : null;
    let signaturePad;

    // Draggable State Variables
    let uploadedImg = null;
    let imgX = 0, imgY = 0;
    let imgWidth = 0, imgHeight = 0;
    let isDragging = false;
    let dragStartX = 0, dragStartY = 0;

    // Role & Identity Setup
    let effectiveRole = document.body.getAttribute('data-role') || 'Admin';
    const isPracticumCoord = document.body.getAttribute('data-practicum') === 'true';
    const userSig = document.body.getAttribute('data-user-sig') || '';
    
    if (isPracticumCoord && !['Program-Chair', 'Dean', 'VPAA'].includes(effectiveRole)) {
        effectiveRole = 'Practicum-Coordinator';
    }

    // Buttons & UI Elements
    const overlay = document.getElementById('sigModalOverlay');
    const openBtn = document.getElementById('openSignatureModal');
    const closeBtn = document.getElementById('closeVipSigBtn');
    const clearBtn = document.getElementById('clearVipSigBtn');
    const saveBtn = document.getElementById('saveVipSigBtn');
    const previewBtn = document.getElementById('previewVipSigBtn');
    const deleteBtn = document.getElementById('deleteVipSigBtn');

    const uploadInput = document.getElementById('uploadVipSignatureInput');
    const cropperModal = document.getElementById('cropperModal');
    const imageToCrop = document.getElementById('imageToCrop');
    const cancelCropBtn = document.getElementById('cancelCropBtn');
    const confirmCropBtn = document.getElementById('confirmCropBtn');
    const drawPlaceholder = document.getElementById('drawPlaceholder');
    let cropper;

    // Helper: Redraws the canvas dynamically while dragging
    function renderCanvas() {
        if (!mainCtx) return;
        mainCtx.clearRect(0, 0, canvas.width, canvas.height);
        if (uploadedImg) {
            mainCtx.drawImage(uploadedImg, imgX, imgY, imgWidth, imgHeight);
        }
    }

    // ====================================================================
    // 2. LIVE SEARCH LOGIC
    // ====================================================================
    const searchInput = document.getElementById('facultySearchInput');
    const tableRows = document.querySelectorAll('#approvalsTable tbody .data-row');

    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const query = this.value.toLowerCase().trim();
            
            tableRows.forEach(row => {
                const nameCell = row.querySelector('.searchable-name');
                if (nameCell) {
                    const nameText = nameCell.textContent.toLowerCase().trim();
                    row.style.display = nameText.includes(query) ? '' : 'none'; 
                }
            });
        });
    }

    // ====================================================================
    // 3. VIP VAULT MODAL INITIALIZATION
    // ====================================================================
    if (openBtn) {
        openBtn.addEventListener('click', () => {
            overlay.style.display = 'flex';
            if (!signaturePad && typeof SignaturePad !== 'undefined' && canvas) {
                signaturePad = new SignaturePad(canvas, { 
                    penColor: "rgb(0, 0, 0)", 
                    backgroundColor: "rgba(0,0,0,0)",
                    minWidth: 1.5,
                    maxWidth: 4.0
                });
            }
        });
    }
    if (closeBtn) closeBtn.addEventListener('click', () => overlay.style.display = 'none');

    // ====================================================================
    // 4. IMAGE UPLOAD & CROPPER ENGINE
    // ====================================================================
    if (uploadInput) {
        uploadInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;

            // Reject non-images
            if (!file.type.startsWith('image/')) {
                alert("Invalid File Format: Please upload a valid image file (PNG, JPG, JPEG).");
                uploadInput.value = ''; 
                return;
            }

            const reader = new FileReader();
            reader.onload = function(event) {
                imageToCrop.src = event.target.result;
                cropperModal.style.display = 'flex';

                if (cropper) cropper.destroy(); 
                cropper = new Cropper(imageToCrop, {
                    aspectRatio: NaN, 
                    viewMode: 1,      
                    autoCropArea: 0.8 
                });
                uploadInput.value = ''; 
            };
            reader.readAsDataURL(file);
        });
    }

    if (cancelCropBtn) {
        cancelCropBtn.addEventListener('click', () => {
            cropperModal.style.display = 'none';
            if (cropper) cropper.destroy();
        });
    }

    if (confirmCropBtn) {
        confirmCropBtn.addEventListener('click', () => {
            if (!cropper || !canvas) return;

            const croppedCanvas = cropper.getCroppedCanvas({ width: 800 });
            const ctx = croppedCanvas.getContext('2d');
            const imgData = ctx.getImageData(0, 0, croppedCanvas.width, croppedCanvas.height);
            const data = imgData.data;

            // PNG-Safe Soft Filter
            for (let i = 0; i < data.length; i += 4) {
                if (data[i+3] < 20) { data[i+3] = 0; continue; }
                const brightness = (data[i] + data[i+1] + data[i+2]) / 3;
                if (brightness > 190) {
                    data[i+3] = 0; 
                } else {
                    const opacity = 255 - ((brightness / 190) * 255);
                    data[i] = 10; data[i+1] = 10; data[i+2] = 30; data[i+3] = opacity; 
                }
            }
            ctx.putImageData(imgData, 0, 0);

            const cssWidth = canvas.offsetWidth || 440;
            const cssHeight = canvas.offsetHeight || 150;
            
            const hRatio = cssWidth / croppedCanvas.width;
            const vRatio = cssHeight / croppedCanvas.height;
            const ratio  = Math.min(hRatio, vRatio) * 0.98; 

            imgWidth = croppedCanvas.width * ratio;
            imgHeight = croppedCanvas.height * ratio;
            imgX = (cssWidth - imgWidth) / 2;
            imgY = (cssHeight - imgHeight) / 2;  

            uploadedImg = new Image();
            uploadedImg.onload = () => {
                if (typeof signaturePad !== 'undefined') signaturePad.off();
                
                renderCanvas();
                canvas.style.cursor = 'grab';
                if (drawPlaceholder) drawPlaceholder.style.display = 'none';
                cropperModal.style.display = 'none';
                cropper.destroy();

                // INSTANT SYNC
                if (typeof signaturePad !== 'undefined') {
                    signaturePad.fromDataURL(canvas.toDataURL(), { ratio: 1, width: canvas.width, height: canvas.height });
                }
            };
            uploadedImg.src = croppedCanvas.toDataURL();
        });
    }

    // ====================================================================
    // 5. INTERACTIVE DRAGGING EVENTS
    // ====================================================================
    if (canvas) {
        const getMousePos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return { x: clientX - rect.left, y: clientY - rect.top };
        };

        const handleStart = (e) => {
            if (!uploadedImg) return;
            const pos = getMousePos(e);
            if (pos.x >= imgX && pos.x <= imgX + imgWidth && pos.y >= imgY && pos.y <= imgY + imgHeight) {
                isDragging = true;
                dragStartX = pos.x - imgX;
                dragStartY = pos.y - imgY;
                canvas.style.cursor = 'grabbing'; 
                e.preventDefault(); 
            }
        };

        const handleMove = (e) => {
            if (!uploadedImg) return;
            const pos = getMousePos(e);
            if (isDragging) {
                imgX = pos.x - dragStartX;
                imgY = pos.y - dragStartY;
                renderCanvas();
                e.preventDefault();
            } else {
                canvas.style.cursor = (pos.x >= imgX && pos.x <= imgX + imgWidth && pos.y >= imgY && pos.y <= imgY + imgHeight) ? 'grab' : 'default';
            }
        };

        const handleEnd = () => {
            if (isDragging && typeof signaturePad !== 'undefined') {
                signaturePad.fromDataURL(canvas.toDataURL(), { ratio: 1, width: canvas.width, height: canvas.height });
            }
            isDragging = false;
            if (uploadedImg) canvas.style.cursor = 'grab';
        };

        canvas.addEventListener('mousedown', handleStart);
        canvas.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleEnd);
        canvas.addEventListener('touchstart', handleStart, {passive: false});
        canvas.addEventListener('touchmove', handleMove, {passive: false});
        window.addEventListener('touchend', handleEnd);
    }

    // ====================================================================
    // 6. CLEAR BUTTON & WATERMARK HIDING
    // ====================================================================
    if (clearBtn) {
        clearBtn.addEventListener('click', () => { 
            uploadedImg = null; 
            if(drawPlaceholder) drawPlaceholder.style.display = 'block';
            if(canvas) canvas.style.cursor = 'crosshair'; 
            
            if (typeof signaturePad !== 'undefined') {
                signaturePad.on();
                signaturePad.clear(); 
            } else {
                renderCanvas();
            }
        });
    }

    if (canvas && drawPlaceholder) {
        canvas.addEventListener('pointerdown', () => drawPlaceholder.style.display = 'none', { capture: true });
        canvas.addEventListener('touchstart', () => drawPlaceholder.style.display = 'none', { capture: true, passive: true });
        if (typeof signaturePad !== 'undefined' && typeof signaturePad.addEventListener === 'function') {
            signaturePad.addEventListener("beginStroke", () => drawPlaceholder.style.display = 'none');
        }
    }

    // ====================================================================
    // 7. API ENDPOINTS (SAVE, PREVIEW, DELETE)
    // ====================================================================
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            if (!confirm("Are you sure you want to completely delete your saved e-signature?")) return;
            const origText = deleteBtn.innerHTML;
            deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
            deleteBtn.disabled = true;

            try {
                const response = await fetch('/ata/settings/signature', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ signatureImage: "" }) 
                });
                if (response.ok) {
                    alert("Signature successfully deleted from your Vault.");
                    location.reload(); 
                } else {
                    alert("Failed to delete signature.");
                    deleteBtn.innerHTML = origText;
                    deleteBtn.disabled = false;
                }
            } catch (error) {
                alert("Network error occurred.");
                deleteBtn.innerHTML = origText;
                deleteBtn.disabled = false;
            }
        });
    }

    if (previewBtn) {
        previewBtn.addEventListener('click', async () => {
            const sigToPreview = (signaturePad && !signaturePad.isEmpty()) ? signaturePad.toDataURL("image/png") : userSig;
            if (!sigToPreview) {
                alert("Please draw a signature first to preview it!");
                return;
            }

            const origText = previewBtn.innerHTML;
            previewBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
            previewBtn.disabled = true;

            try {
                const response = await fetch('/ata/preview-vip-signature', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ signatureImage: sigToPreview, role: effectiveRole })
                });

                if (response.ok) {
                    const blob = await response.blob();
                    window.open(URL.createObjectURL(blob), '_blank');
                } else {
                    const errorMsg = await response.text();
                    alert("Preview failed: " + errorMsg);
                }
            } catch (error) {
                alert("Network error occurred.");
            } finally {
                previewBtn.innerHTML = origText;
                previewBtn.disabled = false;
            }
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            if (!signaturePad || signaturePad.isEmpty()) {
                alert("Please draw a signature before saving!");
                return;
            }

            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            saveBtn.disabled = true;

            try {
                const response = await fetch('/ata/settings/signature', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ signatureImage: signaturePad.toDataURL("image/png") })
                });

                const responseData = await response.json().catch(() => ({})); 

                if (response.ok) {
                    alert("Signature saved securely to your Vault!");
                    location.reload(); 
                } else {
                    alert("Server Rejected Save:\n" + (responseData.error || response.statusText || "Unknown Error"));
                }
            } catch (error) {
                alert("Network error occurred.");
            } finally {
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Signature';
                saveBtn.disabled = false;
            }
        });
    }

    const mainPreviewBtn = document.getElementById('mainPreviewSigBtn');
    const mainDeleteBtn = document.getElementById('mainDeleteSigBtn');

    if (mainPreviewBtn) {
        mainPreviewBtn.addEventListener('click', async () => {
            const origText = mainPreviewBtn.innerHTML;
            mainPreviewBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
            mainPreviewBtn.disabled = true;

            try {
                const response = await fetch('/ata/preview-vip-signature', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ signatureImage: userSig, role: effectiveRole })
                });

                if (response.ok) {
                    const blob = await response.blob();
                    window.open(URL.createObjectURL(blob), '_blank');
                } else {
                    alert("Preview failed: " + await response.text());
                }
            } catch (error) {
                alert("Network error occurred.");
            } finally {
                mainPreviewBtn.innerHTML = origText;
                mainPreviewBtn.disabled = false;
            }
        });
    }

    if (mainDeleteBtn) {
        mainDeleteBtn.addEventListener('click', async () => {
            if (!confirm("Are you sure you want to completely delete your saved e-signature?")) return;
            
            const origText = mainDeleteBtn.innerHTML;
            mainDeleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
            mainDeleteBtn.disabled = true;

            try {
                const response = await fetch('/ata/settings/signature', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ signatureImage: "" }) 
                });

                if (response.ok) {
                    alert("Signature successfully deleted from your Vault.");
                    location.reload(); 
                } else {
                    alert("Failed to delete signature.");
                    mainDeleteBtn.innerHTML = origText;
                    mainDeleteBtn.disabled = false;
                }
            } catch (error) {
                alert("Network error occurred.");
                mainDeleteBtn.innerHTML = origText;
                mainDeleteBtn.disabled = false;
            }
        });
    }
});

// ====================================================================
// 8. GLOBAL FUNCTIONS
// ====================================================================
function toggleHistory(btn) {
    const td = btn.closest('td');
    const hiddenItems = td.querySelectorAll('.hidden-track');
    const textSpan = btn.querySelector('.toggle-txt');
    const icon = btn.querySelector('i');

    const isHidden = hiddenItems[0].style.display === 'none';

    hiddenItems.forEach(item => {
        item.style.display = isHidden ? 'flex' : 'none';
    });

    if (isHidden) {
        textSpan.innerText = 'Show Less';
        icon.className = 'fas fa-chevron-up';
    } else {
        textSpan.innerText = `View ${hiddenItems.length} older actions`;
        icon.className = 'fas fa-chevron-down';
    }
}