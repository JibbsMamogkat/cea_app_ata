document.addEventListener('DOMContentLoaded', () => {
  // ====================================================================
  // 1. STRICT PRE-SUBMISSION VALIDATION
  // ====================================================================
  const nextBtn = document.getElementById('nextBtn');
  if (nextBtn) {
      // 'true' ensures we intercept the click BEFORE ata_client.js does!
      nextBtn.addEventListener('click', (e) => {
          
          if (nextBtn.innerText.toLowerCase().includes('submit')) {
              
              // Gather required fields
              const name = document.getElementById('facultyName')?.value.trim();
              const address = document.getElementById('address')?.value.trim();
              const empStatus = document.getElementById('employmentStatus')?.value;
              const term = document.getElementById('term')?.value;
              const year = document.getElementById('academicYear')?.value.trim();
              const totalUnits = parseFloat(document.getElementById('grandTotalUnits')?.innerText || "0");
              const remedialUnits = parseFloat(document.getElementById('sumEffG')?.innerText || "0");
              
              const isPartTime = document.getElementById('radioPartTime')?.checked;

              let errors = [];
              if (!name) errors.push("Name");
              if (!address) errors.push("Address");
              if (!empStatus) errors.push("Employment Status");
              if (!term) errors.push("Academic Term");
              if (!year) errors.push("Academic Year");

              // 👇 STRICT VALIDATION: Require Outside Employment if Part-Time
              if (isPartTime) {
                  let hasEmployment = false;
                  // Uses #form4 directly to guarantee it finds the rows
                  document.querySelectorAll('#form4 .employment-row').forEach(row => {
                      const inputs = row.querySelectorAll('input');
                      if (inputs[0] && inputs[0].value.trim() !== '') hasEmployment = true;
                      if (inputs[1] && inputs[1].value.trim() !== '') hasEmployment = true;
                  });
                  if (!hasEmployment) {
                      errors.push("Outside Employment Details (Required for Part-Time Faculty)");
                  }
              }

              // Trigger Error Alert
              if (errors.length > 0) {
                  alert("Submission Blocked: Please fill out the following required fields:\n- " + errors.join('\n- '));
                  e.stopImmediatePropagation(); // Kills the submission event instantly
                  return false;
              }

              // 👇 UPDATED: Block 0 Units (Unless they have Remedial Modules!)
              if (totalUnits === 0 && remedialUnits === 0) {
                  alert("Submission Blocked: You must assign at least one regular course or remedial module before submitting.");
                  e.stopImmediatePropagation(); 
                  return false;
              }
              
              // If everything passes, clear the auto-save so a fresh form loads next time!
              localStorage.removeItem('ata_auto_save');
          }
      }, true); 
  }
  // ====================================================================
  // 2. BULLETPROOF DOM-ARRAY AUTO-SAVE ENGINE
  // ====================================================================
  const storageKey = 'ata_auto_save';

  function saveToLocal() {
      const data = { inputs: [], radios: {}, rowCounts: {} };
      
      // 1. Memorize exactly how many rows exist in every single section based on DOM structure
      data.rowCounts.B = document.querySelectorAll('#form2 .form-row:nth-child(1) .course-row').length || 1;
      data.rowCounts.C = document.querySelectorAll('#form2 .form-row:nth-child(2) .course-row').length || 1;
      data.rowCounts.D = document.querySelectorAll('#form3 .form-row:nth-child(1) .admin-row').length || 1;
      data.rowCounts.E = document.querySelectorAll('#form3 .form-row:nth-child(2) .practicum-row').length || 1;
      data.rowCounts.F = document.querySelectorAll('#form4 .employment-row').length || 1;
      data.rowCounts.G = document.querySelectorAll('#form5 .remedial-row').length || 1;

      // 2. Serialize all inputs dynamically in exact top-to-bottom DOM order
      document.querySelectorAll('.form-input, .table-input, textarea').forEach((input) => {
          if (input.type !== 'password' && input.type !== 'file') {
              data.inputs.push(input.value);
          }
      });
      
      // 3. Save Radios
      document.querySelectorAll('input[type="radio"]').forEach((radio) => {
          if (radio.checked) {
              data.radios[radio.name] = radio.value;
          }
      });

      localStorage.setItem(storageKey, JSON.stringify(data));
  }

  function restoreFromLocal() {
      // Abort auto-save restore if they are editing a formal Draft from the database
      if (document.getElementById('existingDraftId')) return;

      const saved = localStorage.getItem(storageKey);
      if (saved) {
          try {
              const data = JSON.parse(saved);
              
              // 1. Ghost click "+ Add" buttons to rebuild HTML structure FIRST
              const rebuildRows = (containerSelector, rowSelector, targetCount) => {
                  const container = document.querySelector(containerSelector);
                  if(!container) return;
                  let currentCount = container.querySelectorAll(rowSelector).length;
                  const addBtn = container.querySelector('.secondary-btn');
                  while(currentCount < targetCount && addBtn) {
                      addBtn.click();
                      currentCount++;
                  }
              };

              if (data.rowCounts) {
                  rebuildRows('#form2 .form-row:nth-child(1)', '.course-row', data.rowCounts.B);
                  rebuildRows('#form2 .form-row:nth-child(2)', '.course-row', data.rowCounts.C);
                  rebuildRows('#form3 .form-row:nth-child(1)', '.admin-row', data.rowCounts.D);
                  rebuildRows('#form3 .form-row:nth-child(2)', '.practicum-row', data.rowCounts.E);
                  rebuildRows('#form4', '.employment-row', data.rowCounts.F);
                  rebuildRows('#form5', '.remedial-row', data.rowCounts.G);
              }

              // 2. Pour the data back into the exact identical boxes
              if (data.inputs && data.inputs.length > 0) {
                  const allInputs = document.querySelectorAll('.form-input, .table-input, textarea');
                  allInputs.forEach((input, index) => {
                      if (data.inputs[index] !== undefined) {
                          input.value = data.inputs[index];
                      }
                  });
              }

              // 3. Restore Radios and WAKE UP the Part-Time UI
              if (data.radios) {
                  document.querySelectorAll('input[type="radio"]').forEach((radio) => {
                      if (data.radios[radio.name] === radio.value) {
                          // 🔥 Instead of just setting true, we forcefully CLICK it to wake up ata_client.js!
                          radio.click(); 
                      }
                  });
              }
              
              // 4. Force Math Engine Recalculation
              setTimeout(() => {
                  document.querySelectorAll('.table-input').forEach(el => {
                      if(el.value) el.dispatchEvent(new Event('input', { bubbles: true }));
                  });
              }, 300);

          } catch (err) {
              console.error('Failed to parse saved ATA auto-save data.', err);
          }
      }
  }

    // Save on literally any input or change event
    document.addEventListener('input', saveToLocal);
    document.addEventListener('change', saveToLocal);
    document.addEventListener('click', (e) => {
        if (e.target.closest('.secondary-btn') || e.target.closest('.remove-btn')) {
            setTimeout(saveToLocal, 100); // Save state when rows are added/removed
        }
    });

    // Run the restorer on page load
    restoreFromLocal();
});

document.addEventListener('DOMContentLoaded', () => {
    // Force remove "ATA form:" from the main title dynamically
    const titleH1 = document.querySelector('#formTitle h1');
    if (titleH1) {
        const stripTitle = () => {
            if (titleH1.innerText.includes('ATA form:')) {
                titleH1.innerText = titleH1.innerText.replace('ATA form:', '').trim();
            }
        };
        stripTitle(); 
        const observer = new MutationObserver(stripTitle);
        observer.observe(titleH1, { childList: true, characterData: true, subtree: true });
    }

    // Eradicate the ugly native browser tooltips injected by ata_client.js
    const dots = document.querySelectorAll('.progress-dot');
    dots.forEach(dot => {
          dot.removeAttribute('title'); 
          const dotObserver = new MutationObserver((mutations) => {
              mutations.forEach(mutation => {
                  if (mutation.type === 'attributes' && mutation.attributeName === 'title') {
                      dot.removeAttribute('title');
                  }
              });
          });
        dotObserver.observe(dot, { attributes: true });
    });
    // ====================================================================
    // 3. STRICT VALIDATION, CROPPER, & INTERACTIVE DRAG-AND-DROP ENGINE
    // ====================================================================
    const uploadInput = document.getElementById('uploadSignatureInput');
    const cropperModal = document.getElementById('cropperModal');
    const imageToCrop = document.getElementById('imageToCrop');
    const cancelCropBtn = document.getElementById('cancelCropBtn');
    const confirmCropBtn = document.getElementById('confirmCropBtn');
    const mainCanvas = document.getElementById('signatureCanvas');
    const mainCtx = mainCanvas.getContext('2d');
    let cropper; 

    // 🕹️ DRAGGABLE STATE VARIABLES
    let uploadedImg = null;
    let imgX = 0, imgY = 0;
    let imgWidth = 0, imgHeight = 0;
    let isDragging = false;
    let dragStartX = 0, dragStartY = 0;

    // Redraws the canvas dynamically while dragging
    function renderCanvas() {
        mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
        if (uploadedImg) {
            mainCtx.drawImage(uploadedImg, imgX, imgY, imgWidth, imgHeight);
        }
    }

    if (uploadInput) {
        // ---------------------------------------------------------
        // 1. FILE UPLOAD & STRICT VALIDATION
        // ---------------------------------------------------------
        uploadInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;

            // 🛑 STRICT INPUT VALIDATION: Reject anything that isn't an image
            if (!file.type.startsWith('image/')) {
                alert("Invalid File Format: Please upload a valid image file (PNG, JPG, JPEG).\nDocuments (like PDFs or Word files) are not allowed.");
                uploadInput.value = ''; // Instantly clear the invalid file
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

        // ---------------------------------------------------------
        // 2. MODAL BUTTONS (CANCEL & CONFIRM)
        // ---------------------------------------------------------
        cancelCropBtn.addEventListener('click', () => {
            cropperModal.style.display = 'none';
            if (cropper) cropper.destroy();
        });

        confirmCropBtn.addEventListener('click', () => {
            if (!cropper) return;

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

            // Establish final image dimensions
            const cssWidth = mainCanvas.offsetWidth || 400;
            const cssHeight = mainCanvas.offsetHeight || 150;
            
            const hRatio = cssWidth / croppedCanvas.width;
            const vRatio = cssHeight / croppedCanvas.height;
            const ratio  = Math.min(hRatio, vRatio) * 0.85; 

            imgWidth = croppedCanvas.width * ratio;
            imgHeight = croppedCanvas.height * ratio;
            
            // Start the image perfectly centered
            imgX = (cssWidth - imgWidth) / 2;
            imgY = (cssHeight - imgHeight) / 2;  

            // Generate the draggable image object
            uploadedImg = new Image();
            uploadedImg.onload = () => {
                    // 🛑 SHUT OFF THE DRAWING PEN
                    if (typeof signaturePad !== 'undefined') {
                        signaturePad.off();
                    }
                    
                    // Draw it to the screen and change cursor
                    renderCanvas();
                    mainCanvas.style.cursor = 'grab';
                    document.getElementById('drawPlaceholder').style.display = 'none';
                    cropperModal.style.display = 'none';
                    cropper.destroy();

                    // 🛑 THE FIX: INSTANTLY SYNC TO SIGNATURE PAD!
                    // This guarantees the PDF gets the image even if the user never touches it.
                    if (typeof signaturePad !== 'undefined') {
                        signaturePad.fromDataURL(mainCanvas.toDataURL(), { 
                            ratio: 1, 
                            width: mainCanvas.width, 
                            height: mainCanvas.height 
                        });
                    }
                };
            uploadedImg.src = croppedCanvas.toDataURL();
        });

        // ---------------------------------------------------------
        // 3. INTERACTIVE MOUSE / TOUCH EVENTS FOR DRAGGING
        // ---------------------------------------------------------
        const getMousePos = (e) => {
            const rect = mainCanvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return { x: clientX - rect.left, y: clientY - rect.top };
        };

        const handleStart = (e) => {
            if (!uploadedImg) return;
            const pos = getMousePos(e);
            
            // Check if user clicked INSIDE the bounding box of the signature
            if (pos.x >= imgX && pos.x <= imgX + imgWidth && pos.y >= imgY && pos.y <= imgY + imgHeight) {
                isDragging = true;
                dragStartX = pos.x - imgX;
                dragStartY = pos.y - imgY;
                mainCanvas.style.cursor = 'grabbing'; // Clenched hand cursor
                e.preventDefault(); 
            }
        };

        const handleMove = (e) => {
            if (!uploadedImg) return;
            const pos = getMousePos(e);

            if (isDragging) {
                // Move the image
                imgX = pos.x - dragStartX;
                imgY = pos.y - dragStartY;
                renderCanvas();
                e.preventDefault();
            } else {
                // Hover effect: Open hand if over image, pointer if not
                if (pos.x >= imgX && pos.x <= imgX + imgWidth && pos.y >= imgY && pos.y <= imgY + imgHeight) {
                    mainCanvas.style.cursor = 'grab';
                } else {
                    mainCanvas.style.cursor = 'default';
                }
            }
        };

        const handleEnd = () => {
            if (isDragging && typeof signaturePad !== 'undefined') {
                // SECRET SYNC: Tell SignaturePad where the image landed so the form submission doesn't fail!
                signaturePad.fromDataURL(mainCanvas.toDataURL(), { ratio: 1, width: mainCanvas.width, height: mainCanvas.height });
            }
            isDragging = false;
            if (uploadedImg) mainCanvas.style.cursor = 'grab';
        };

        // Bind events for Desktop
        mainCanvas.addEventListener('mousedown', handleStart);
        mainCanvas.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleEnd);
        
        // Bind events for Mobile/Tablets
        mainCanvas.addEventListener('touchstart', handleStart, {passive: false});
        mainCanvas.addEventListener('touchmove', handleMove, {passive: false});
        window.addEventListener('touchend', handleEnd);

        // ---------------------------------------------------------
        // 4. OVERRIDE THE "CLEAR" BUTTON
        // ---------------------------------------------------------
        const clearBtn = document.getElementById('clearSignatureBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                uploadedImg = null; // Delete the image from memory
                document.getElementById('drawPlaceholder').style.display = 'block';
                mainCanvas.style.cursor = 'crosshair'; // Return to drawing cursor
                
                if (typeof signaturePad !== 'undefined') {
                    signaturePad.on(); // 🟢 TURN THE PEN BACK ON
                    signaturePad.clear(); // Wipe the canvas
                } else {
                    renderCanvas();
                }
            });
        }
    }
    // ====================================================================
    // 5. BULLETPROOF PLACEHOLDER HIDING
    // ====================================================================
    const drawPlaceholder = document.getElementById('drawPlaceholder');
    if (mainCanvas && drawPlaceholder) {
        // 1. Force our code to run BEFORE SignaturePad swallows the event using { capture: true }
        mainCanvas.addEventListener('pointerdown', () => {
            drawPlaceholder.style.display = 'none';
        }, { capture: true });

        mainCanvas.addEventListener('touchstart', () => {
            drawPlaceholder.style.display = 'none';
        }, { capture: true, passive: true });
        
        // 2. Just in case, hook directly into SignaturePad's internal engine
        if (typeof signaturePad !== 'undefined' && typeof signaturePad.addEventListener === 'function') {
            signaturePad.addEventListener("beginStroke", () => {
                drawPlaceholder.style.display = 'none';
            });
        }
    }
});

