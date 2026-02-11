// Employee Onboarding Form with Company Data in Same Row
class OnboardingForm {
    constructor() {
        this.currentSection = 1;
        this.educationCount = 1;
        this.experienceCount = 0;
        this.statesData = {};
        this.educationInstitutions = {};
        this.universities = [];
        this.existingCSVData = null; // Store existing CSV data
        this.existingCSVFileName = 'employee_data.csv'; // Default file name
        
        this.init();
    }

    init() {
        console.log('Initializing Onboarding Form...');
        this.bindEvents();
        this.initializeStateDistricts();
        this.loadEducationData();
        this.loadUniversityData();
        this.addRealTimeValidation();
        this.updateProgress();
        console.log('Onboarding Form initialized successfully');
    }

    bindEvents() {
        console.log('Binding events...');

        // Same address checkbox
        const sameAsCurrent = document.getElementById('sameAsCurrent');
        if (sameAsCurrent) {
            sameAsCurrent.addEventListener('change', (e) => {
                if (e.target.checked) {
                    const currentAddress = document.getElementById('currentAddress');
                    const permanentAddress = document.getElementById('permanentAddress');
                    if (currentAddress && permanentAddress) {
                        permanentAddress.value = currentAddress.value;
                    }
                }
            });
        }

        // State change event
        const stateSelect = document.getElementById('state');
        if (stateSelect) {
            stateSelect.addEventListener('change', (e) => this.loadDistricts(e.target.value));
        }

        // Work experience radio
        document.querySelectorAll('input[name="hasExperience"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.toggleExperienceSection(e.target.value === 'Yes');
                if (e.target.value === 'No') {
                    this.clearExperienceValidation();
                }
            });
        });

        // Conditional fields
        document.querySelectorAll('input[name="previousInterview"], input[name="criminalCase"], input[name="disability"]').forEach(radio => {
            radio.addEventListener('change', (e) => this.toggleConditionalFields(e.target.name, e.target.value));
        });

        // Form submission
        const onboardingForm = document.getElementById('onboardingForm');
        if (onboardingForm) {
            onboardingForm.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        // Institute/University autocomplete
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('institute-name')) {
                this.showInstituteSuggestions(e.target);
            }
            if (e.target.classList.contains('board-university')) {
                this.showUniversitySuggestions(e.target);
            }
        });

        // CSV Upload handler
        const csvFileInput = document.getElementById('csvFileInput');
        if (csvFileInput) {
            csvFileInput.addEventListener('change', (e) => this.handleCSVUpload(e));
        }

        // CSV Upload button click handler
        const csvUploadBtn = document.getElementById('csvUploadBtn');
        if (csvUploadBtn) {
            csvUploadBtn.addEventListener('click', () => {
                const csvFileInput = document.getElementById('csvFileInput');
                if (csvFileInput) {
                    csvFileInput.click();
                }
            });
        }

        // Initialize floating labels
        this.initializeFloatingLabels();

        console.log('All events bound successfully');
    }

    // ===== CSV UPLOAD AND APPEND FUNCTIONS =====
    
    /**
     * Handle CSV file upload
     * @param {Event} event - File input change event
     */
    handleCSVUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.name.endsWith('.csv')) {
            this.showNotification('Please select a valid CSV file', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                this.existingCSVData = e.target.result;
                this.existingCSVFileName = file.name;
                this.showNotification(`CSV file loaded: ${file.name} (${this.countCSVRows(this.existingCSVData)} records found)`, 'success');
                console.log('CSV file uploaded successfully. File size:', file.size, 'bytes');
            } catch (error) {
                this.showNotification('Error reading CSV file', 'error');
                console.error('CSV upload error:', error);
            }
        };

        reader.onerror = () => {
            this.showNotification('Error reading file', 'error');
        };

        reader.readAsText(file);
    }

    /**
     * Count number of data rows in CSV (excluding header)
     * @param {string} csvContent - CSV content string
     * @returns {number} Number of rows excluding header
     */
    countCSVRows(csvContent) {
        if (!csvContent) return 0;
        const lines = csvContent.trim().split('\n');
        return Math.max(0, lines.length - 1); // Subtract header
    }

    /**
     * Parse CSV content and extract rows
     * @param {string} csvContent - CSV content string
     * @returns {Array} Array of CSV rows
     */
    parseCSVRows(csvContent) {
        if (!csvContent) return [];
        
        const rows = [];
        const lines = csvContent.trim().split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            rows.push(lines[i]);
        }
        
        return rows;
    }

    /**
     * Get CSV header row
     * @returns {string} CSV header row
     */
    getCSVHeader() {
        const headers = [
            // ================= BASIC + COMPANY INFO (12+4 = 16) =================
            'Salutation',
            'First Name',
            'Last Name',
            'Full Name',
            "Father's Name",
            'Date of Joining',
            'Contact Number',
            'Email Address',
            'Gender',
            'Marital Status',
            'Date of Birth',
            'Blood Group',

            'Branch',
            'Department',
            'Designation',
            'Report To',

            // ================= ADDRESS & IDENTIFICATION (9+3 = 12) =================
            'Personal Email',
            'Company Email',
            'Current Address',
            'Permanent Address',
            'Country',
            'State',
            'District',
            'City',
            'Pincode',

            'Aadhar Number',
            'PAN Number',
            'Passport Number',

            // ================= OTHER INFO (9) =================
            'Previous Interview',
            'Previous Interview Details',
            'Criminal Case',
            'Criminal Case Details',
            'Disability',
            'Disability Details',
            'E-Signature',
            'Signature Date',
            'Signature Place',

            // ================= EDUCATION (7) =================
            'Education Level',
            'Qualification',
            'Year of Passing',
            'Institute Name',
            'Board/University',
            'Percentage',
            'Specialization',

            // ================= EXPERIENCE (8) =================
            'Company',
            'Job Designation',
            'From Date',
            'To Date',
            'Company Address',
            'Company Contact',
            'CTC (Annual)',
            'Reason for Leaving'
        ];

        return headers.join(',');
    }

    /**
     * Append new employee record to existing CSV
     * @param {Object} formData - Form data object
     * @returns {string} Updated CSV content
     */
    appendToCSV(formData) {
        let csvContent = '';

        // If no existing CSV data, create with header
        if (!this.existingCSVData) {
            csvContent = this.getCSVHeader() + '\n';
            console.log('No existing CSV data. Creating new file with header.');
        } else {
            // Use existing CSV content (preserves all old data)
            csvContent = this.existingCSVData;
            // Ensure it ends with newline if it doesn't
            if (!csvContent.endsWith('\n')) {
                csvContent += '\n';
            }
            console.log('Appending to existing CSV. Current rows:', this.countCSVRows(csvContent));
        }

        // ================= ADD NEW ROW LOGIC =================
        // Row1 = complete info + edu1 + exp1
        const row1 = this.createCSVRow(formData, 0, 0, true);
        csvContent += row1 + '\n';

        // Remaining rows → education[i] + experience[i] SAME row
        const maxRows = Math.max(formData.education.length, formData.experience.length);

        for (let i = 1; i < maxRows; i++) {
            const row = this.createCSVRow(formData, i, i, false);
            csvContent += row + '\n';
        }

        console.log('New record(s) added. Total rows now:', this.countCSVRows(csvContent));
        return csvContent;
    }

    addRealTimeValidation() {
        console.log('Adding real-time validation...');
        
        document.querySelectorAll('input, select, textarea').forEach(input => {
            input.addEventListener('blur', () => {
                if (input.hasAttribute('required')) {
                    const value = input.value.trim();
                    
                    if (!value) {
                        input.classList.add('is-invalid');
                        this.showFieldError(input, 'This field is required');
                    } else {
                        input.classList.remove('is-invalid');
                        this.removeFieldError(input);
                        this.validateFieldType(input, value);
                    }
                }
            });
            
            input.addEventListener('input', () => {
                if (input.classList.contains('is-invalid')) {
                    input.classList.remove('is-invalid');
                    this.removeFieldError(input);
                }
            });
        });
        
        document.querySelectorAll('input[type="radio"][required]').forEach(radio => {
            radio.addEventListener('change', () => {
                const radioName = radio.name;
                const radioGroup = document.querySelectorAll(`input[name="${radioName}"]`);
                const errorDiv = document.getElementById(`${radioName}Error`) || 
                               radioGroup[0].closest('.form-check')?.nextElementSibling;
                
                if (document.querySelector(`input[name="${radioName}"]:checked`)) {
                    radioGroup.forEach(r => r.classList.remove('is-invalid'));
                    if (errorDiv && errorDiv.classList.contains('invalid-feedback')) {
                        errorDiv.style.display = 'none';
                    }
                }
            });
        });
        
        console.log('Real-time validation added');
    }

    showFieldError(input, message) {
        this.removeFieldError(input);
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'invalid-feedback';
        errorDiv.textContent = message;
        errorDiv.style.fontSize = '14px';
        errorDiv.style.color = '#dc3545';
        errorDiv.style.marginTop = '5px';
        
        input.parentNode.insertBefore(errorDiv, input.nextSibling);
    }

    removeFieldError(input) {
        const existingError = input.nextElementSibling;
        if (existingError && existingError.classList.contains('invalid-feedback')) {
            existingError.remove();
        }
    }

    validateFieldType(input, value) {
        let isValid = true;
        let errorMessage = '';
        
        switch(input.type) {
            case 'email':
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value)) {
                    isValid = false;
                    errorMessage = 'Please enter a valid email address';
                }
                break;
                
            case 'tel':
                if (input.id === 'contactNumber') {
                    const phoneRegex = /^[0-9]{10}$/;
                    if (!phoneRegex.test(value.replace(/\D/g, ''))) {
                        isValid = false;
                        errorMessage = 'Please enter a valid 10-digit mobile number';
                    }
                }
                break;
                
            case 'text':
                if (input.id === 'aadharNumber') {
                    const aadharRegex = /^[0-9]{12}$/;
                    if (!aadharRegex.test(value.replace(/\s/g, ''))) {
                        isValid = false;
                        errorMessage = 'Please enter a valid 12-digit Aadhar number';
                    }
                }
                if (input.id === 'panNumber' && value) {
                    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
                    if (!panRegex.test(value.toUpperCase())) {
                        isValid = false;
                        errorMessage = 'Please enter a valid PAN number';
                    }
                }
                if (input.id === 'pincode') {
                    const pincodeRegex = /^[0-9]{6}$/;
                    if (!pincodeRegex.test(value)) {
                        isValid = false;
                        errorMessage = 'Please enter a valid 6-digit pincode';
                    }
                }
                break;
                
            case 'date':
                if (input.id === 'dateOfBirth') {
                    const dob = new Date(value);
                    const today = new Date();
                    const minAgeDate = new Date();
                    minAgeDate.setFullYear(today.getFullYear() - 18);
                    
                    if (dob > minAgeDate) {
                        isValid = false;
                        errorMessage = 'You must be at least 18 years old';
                    }
                }
                break;
        }
        
        if (!isValid && errorMessage) {
            input.classList.add('is-invalid');
            this.showFieldError(input, errorMessage);
        }
        
        return isValid;
    }

    initializeFloatingLabels() {
        document.querySelectorAll('.floating-input input, .floating-input select, .floating-input textarea').forEach(input => {
            this.updateLabelPosition(input);
            
            input.addEventListener('focus', () => this.updateLabelPosition(input));
            input.addEventListener('blur', () => this.updateLabelPosition(input));
            input.addEventListener('input', () => this.updateLabelPosition(input));
            input.addEventListener('change', () => this.updateLabelPosition(input));
        });
    }

    updateLabelPosition(input) {
        const label = input.previousElementSibling;
        if (label && label.tagName === 'LABEL') {
            if (input.value || input === document.activeElement) {
                label.style.top = '-12px';
                label.style.transform = 'scale(0.95)';
                label.style.color = '#1565D8';
            } else {
                label.style.top = '-12px';
                label.style.transform = 'scale(1)';
                label.style.color = '#001C73';
            }
        }
    }

    initializeStateDistricts() {
        this.statesData = {
            'Odisha': [
                'Khordha', 'Cuttack', 'Puri', 'Bhubaneswar', 'Baleswar', 
                'Bhadrak', 'Jajpur', 'Kendrapara', 'Kendujhar', 'Mayurbhanj'
            ],
            'Telangana': [
                'Hyderabad', 'Rangareddy', 'Medchal', 'Sangareddy', 'Vikarabad',
                'Mahabubnagar', 'Nalgonda', 'Warangal', 'Khammam', 'Karimnagar'
            ]
        };
    }

    loadDistricts(state) {
        const districtSelect = document.getElementById('district');
        if (!districtSelect) return;
        
        districtSelect.innerHTML = '<option value="" selected disabled>Select district</option>';
        
        if (this.statesData[state]) {
            districtSelect.disabled = false;
            this.statesData[state].forEach(district => {
                const option = document.createElement('option');
                option.value = district;
                option.textContent = district;
                districtSelect.appendChild(option);
            });
        } else if (state === 'Other') {
            districtSelect.disabled = false;
            districtSelect.innerHTML += '<option value="Other">Other</option>';
        } else {
            districtSelect.disabled = true;
        }
    }

    async loadEducationData() {
        this.educationInstitutions = {
            'Odisha': [
                'KIIT University, Bhubaneswar',
                'Siksha O Anusandhan University, Bhubaneswar',
                'National Institute of Technology, Rourkela',
                'Indian Institute of Technology, Bhubaneswar',
                'Ravenshaw University, Cuttack',
                'Utkal University, Bhubaneswar',
                'College of Engineering and Technology, Bhubaneswar',
                'Sri Sri University, Cuttack'
            ],
            'Telangana': [
                'University of Hyderabad',
                'International Institute of Information Technology, Hyderabad',
                'Osmania University, Hyderabad',
                'Jawaharlal Nehru Technological University, Hyderabad',
                'National Institute of Technology, Warangal',
                'Indian Institute of Technology, Hyderabad',
                'Indian School of Business, Hyderabad',
                'Maulana Azad National Urdu University, Hyderabad'
            ]
        };
    }

    async loadUniversityData() {
        this.universities = [
            'KIIT University',
            'Siksha O Anusandhan University',
            'National Institute of Technology',
            'Indian Institute of Technology',
            'University of Hyderabad',
            'Osmania University',
            'Jawaharlal Nehru Technological University',
            'Utkal University',
            'Ravenshaw University',
            'Sri Sri University'
        ];
    }

    showInstituteSuggestions(input) {
        const index = input.dataset.index;
        const suggestionsDiv = document.getElementById(`suggestions${index}`);
        if (!suggestionsDiv) return;
        
        const value = input.value.toLowerCase();
        
        if (value.length < 2) {
            suggestionsDiv.style.display = 'none';
            return;
        }
        
        let suggestions = [];
        Object.values(this.educationInstitutions).forEach(arr => {
            suggestions.push(...arr.filter(inst => 
                inst.toLowerCase().includes(value)
            ));
        });
        
        if (suggestions.length === 0) {
            suggestions = ['Other - Please specify'];
        }
        
        suggestionsDiv.innerHTML = suggestions.map(inst => 
            `<div class="suggestion-item" onclick="onboardingForm.selectInstitute('${index}', '${inst.replace(/'/g, "\\'")}')">${inst}</div>`
        ).join('');
        
        suggestionsDiv.style.display = 'block';
    }

    showUniversitySuggestions(input) {
        const index = input.dataset.index;
        const suggestionsDiv = document.getElementById(`uniSuggestions${index}`);
        if (!suggestionsDiv) return;
        
        const value = input.value.toLowerCase();
        
        if (value.length < 2) {
            suggestionsDiv.style.display = 'none';
            return;
        }
        
        const suggestions = this.universities.filter(uni => 
            uni.toLowerCase().includes(value)
        );
        
        suggestionsDiv.innerHTML = suggestions.map(uni => 
            `<div class="suggestion-item" onclick="onboardingForm.selectUniversity('${index}', '${uni.replace(/'/g, "\\'")}')">${uni}</div>`
        ).join('');
        
        suggestionsDiv.style.display = 'block';
    }

    selectInstitute(index, institute) {
        const input = document.querySelector(`.institute-name[data-index="${index}"]`);
        if (input) {
            input.value = institute;
            const suggestionsDiv = document.getElementById(`suggestions${index}`);
            if (suggestionsDiv) {
                suggestionsDiv.style.display = 'none';
            }
        }
    }

    selectUniversity(index, university) {
        const input = document.querySelector(`.board-university[data-index="${index}"]`);
        if (input) {
            input.value = university;
            const suggestionsDiv = document.getElementById(`uniSuggestions${index}`);
            if (suggestionsDiv) {
                suggestionsDiv.style.display = 'none';
            }
        }
    }

    addEducationEntry() {
        const container = document.getElementById('educationContainer');
        if (!container) return;
        
        const newEntry = document.createElement('div');
        newEntry.className = 'education-entry mb-4 p-3 border rounded';
        newEntry.innerHTML = `
            <div class="row g-3">
                <div class="col-md-2">
                    <div class="floating-input">
                        <label for="educationLevel${this.educationCount}">Level<span class="required">*</span></label>
                        <select class="education-level" data-index="${this.educationCount}" required>
                            <option value="" selected disabled>Select</option>
                            <option value="10th/Matriculation">10th/Matriculation</option>
                            <option value="12th/Intermediate">12th/Intermediate</option>
                            <option value="Diploma">Diploma</option>
                            <option value="Undergraduate">Undergraduate</option>
                            <option value="Graduate">Graduate</option>
                            <option value="Post-Graduate">Post-Graduate</option>
                            <option value="Doctorate">Doctorate</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                </div>
                <div class="col-md-2">
                    <div class="floating-input">
                        <label for="qualification${this.educationCount}">Qualification<span class="required">*</span></label>
                        <input type="text" class="qualification" data-index="${this.educationCount}" placeholder="e.g., B.Tech" required>
                    </div>
                </div>
                <div class="col-md-2">
                    <div class="floating-input">
                        <label for="yearOfPassing${this.educationCount}">Year of Passing<span class="required">*</span></label>
                        <input type="month" class="year-of-passing" data-index="${this.educationCount}" required>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="floating-input">
                        <label for="instituteName${this.educationCount}">Institute Name<span class="required">*</span></label>
                        <input type="text" class="institute-name" data-index="${this.educationCount}" placeholder="Start typing..." required>
                        <div class="institute-suggestions" id="suggestions${this.educationCount}"></div>
                    </div>
                </div>
                <div class="col-md-2">
                    <div class="floating-input">
                        <label for="boardUniversity${this.educationCount}">Board/University<span class="required">*</span></label>
                        <input type="text" class="board-university" data-index="${this.educationCount}" placeholder="Start typing..." required>
                        <div class="university-suggestions" id="uniSuggestions${this.educationCount}"></div>
                    </div>
                </div>
                <div class="col-md-1">
                    <div class="floating-input">
                        <label for="percentage${this.educationCount}">% / CGPA<span class="required">*</span></label>
                        <input type="text" class="percentage" data-index="${this.educationCount}" placeholder="e.g., 85%" required>
                    </div>
                </div>
            </div>
            <div class="row g-3 mt-2">
                <div class="col-md-2">
                    <div class="floating-input">
                        <label for="specialization${this.educationCount}">Specialization</label>
                        <input type="text" class="specialization" data-index="${this.educationCount}" placeholder="e.g., AI & ML">
                    </div>
                </div>
                <div class="col-md-10 text-end">
                    <button
                        type="button"
                        class="btn btn-danger btn-sm"
                        onclick="onboardingForm.removeEducationEntry(${this.educationCount})"
                    >
                        <i class="fas fa-trash me-1"></i>Delete
                    </button>
                </div>
            </div>
        `;
        
        container.appendChild(newEntry);
        
        setTimeout(() => {
            newEntry.querySelectorAll('.floating-input input, .floating-input select').forEach(input => {
                this.updateLabelPosition(input);
                
                input.addEventListener('focus', () => this.updateLabelPosition(input));
                input.addEventListener('blur', () => this.updateLabelPosition(input));
                input.addEventListener('input', () => this.updateLabelPosition(input));
                input.addEventListener('change', () => this.updateLabelPosition(input));
            });
        }, 100);
        
        this.educationCount++;
    }

    addExperienceEntry() {
        const container = document.getElementById('experienceContainer');
        if (!container) return;
        
        const newEntry = document.createElement('div');
        newEntry.className = 'experience-entry mb-4 p-3 border rounded';
        newEntry.innerHTML = `
            <div class="row g-3">
                <div class="col-md-4">
                    <div class="floating-input">
                        <label for="company${this.experienceCount}">Company<span class="required">*</span></label>
                        <input type="text" class="company" data-index="${this.experienceCount}" placeholder="Company name" required>
                        <div class="invalid-feedback">Please enter company name</div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="floating-input">
                        <label for="designation${this.experienceCount}">Designation<span class="required">*</span></label>
                        <input type="text" class="designation" data-index="${this.experienceCount}" placeholder="Your position" required>
                        <div class="invalid-feedback">Please enter designation</div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="floating-input">
                        <label for="fromDate${this.experienceCount}">From Date<span class="required">*</span></label>
                        <input type="month" class="from-date" data-index="${this.experienceCount}" required>
                        <div class="invalid-feedback">Please select from date</div>
                    </div>
                </div>
            </div>
            
            <div class="row g-3 mt-2">
                <div class="col-md-4">
                    <div class="floating-input">
                        <label for="toDate${this.experienceCount}">To Date</label>
                        <input type="month" class="to-date" data-index="${this.experienceCount}" placeholder="Present if current">
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="floating-input">
                        <label for="experienceAddress${this.experienceCount}">Company Address</label>
                        <input type="text" class="experience-address" data-index="${this.experienceCount}" placeholder="Company address">
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="floating-input">
                        <label for="companyContact${this.experienceCount}">Company Contact</label>
                        <input type="tel" class="company-contact" data-index="${this.experienceCount}" placeholder="Company phone">
                    </div>
                </div>
            </div>

            <div class="row g-3 mt-2">
                <div class="col-md-3">
                    <div class="floating-input">
                        <label for="ctc${this.experienceCount}">CTC (Annual)</label>
                        <input type="text" class="ctc" data-index="${this.experienceCount}" placeholder="e.g., 6 LPA">
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="floating-input">
                        <label for="reasonForLeaving${this.experienceCount}">Reason for Leaving</label>
                        <input type="text" class="reason-for-leaving" data-index="${this.experienceCount}" placeholder="Why you left">
                    </div>
                </div>
            </div>

            <div class="row g-3 mt-2">
                <div class="col-md-12 text-end">
                    <button
                        type="button"
                        class="btn btn-danger btn-sm"
                        onclick="onboardingForm.removeExperienceEntry(${this.experienceCount})"
                    >
                        <i class="fas fa-trash me-1"></i>Delete Experience
                    </button>
                </div>
            </div>
        `;
        
        container.appendChild(newEntry);
        
        setTimeout(() => {
            newEntry.querySelectorAll('.floating-input input, .floating-input select').forEach(input => {
                this.updateLabelPosition(input);
                
                input.addEventListener('focus', () => this.updateLabelPosition(input));
                input.addEventListener('blur', () => this.updateLabelPosition(input));
                input.addEventListener('input', () => this.updateLabelPosition(input));
                input.addEventListener('change', () => this.updateLabelPosition(input));
            });
        }, 100);
        
        this.experienceCount++;
    }

    removeEducationEntry(index) {
        const entries = document.querySelectorAll('.education-entry');
        if (entries.length === 1) {
            this.showNotification('You must keep at least one education entry', 'warning');
            return;
        }
        
        let entryToRemove = null;
        entries.forEach(entry => {
            if (entry.querySelector(`[data-index="${index}"]`)) {
                entryToRemove = entry;
            }
        });
        
        if (entryToRemove) {
            entryToRemove.remove();
            this.showNotification('Education entry removed successfully', 'success');
        }
    }

    removeExperienceEntry(index) {
        const entries = document.querySelectorAll('.experience-entry');
        if (entries.length === 1) {
            this.showNotification('You must keep at least one experience entry', 'warning');
            return;
        }
        
        let entryToRemove = null;
        entries.forEach(entry => {
            if (entry.querySelector(`[data-index="${index}"]`)) {
                entryToRemove = entry;
            }
        });
        
        if (entryToRemove) {
            entryToRemove.remove();
            this.showNotification('Experience entry removed successfully', 'success');
        }
    }

    toggleExperienceSection(show) {
        const container = document.getElementById('experienceContainer');
        const addBtn = document.getElementById('addExperienceBtn');
        
        if (container && addBtn) {
            if (show) {
                container.style.display = 'block';
                addBtn.style.display = 'block';
                if (this.experienceCount === 0) {
                    this.addExperienceEntry();
                }
            } else {
                container.style.display = 'none';
                addBtn.style.display = 'none';
            }
        }
    }

    clearExperienceValidation() {
        const container = document.getElementById('experienceContainer');
        if (container) {
            container.querySelectorAll('input, select').forEach(input => {
                input.classList.remove('is-invalid');
                this.removeFieldError(input);
            });
        }
    }

    toggleConditionalFields(name, value) {
        const fieldMap = {
            'previousInterview': 'previousInterviewDetails',
            'criminalCase': 'criminalCaseDetails',
            'disability': 'disabilityDetails'
        };
        
        const detailsDiv = document.getElementById(fieldMap[name]);
        if (detailsDiv) {
            detailsDiv.style.display = value === 'Yes' ? 'block' : 'none';
        }
    }

    nextSection(next) {
        console.log(`Attempting to navigate to section ${next} from section ${this.currentSection}`);
        
        if (this.validateSection(this.currentSection)) {
            const currentSectionEl = document.getElementById(`section${this.currentSection}`);
            if (currentSectionEl) {
                currentSectionEl.style.display = 'none';
            }
            
            const nextSectionEl = document.getElementById(`section${next}`);
            if (nextSectionEl) {
                nextSectionEl.style.display = 'block';
                this.currentSection = next;
                this.updateProgress();
                
                window.scrollTo({ top: 0, behavior: 'smooth' });
                
                console.log(`Successfully navigated to section ${next}`);
                return true;
            }
        } else {
            this.showNotification('Please fill all required fields correctly', 'error');
            this.scrollToFirstInvalid();
        }
        
        return false;
    }

    prevSection(prev) {
        console.log(`Navigating back to section ${prev} from section ${this.currentSection}`);
        
        const currentSectionEl = document.getElementById(`section${this.currentSection}`);
        if (currentSectionEl) {
            currentSectionEl.style.display = 'none';
        }
        
        const prevSectionEl = document.getElementById(`section${prev}`);
        if (prevSectionEl) {
            prevSectionEl.style.display = 'block';
            this.currentSection = prev;
            this.updateProgress();
            
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            console.log(`Successfully navigated back to section ${prev}`);
        }
    }

    validateSection(section) {
        let isValid = true;
        const sectionEl = document.getElementById(`section${section}`);
        
        if (!sectionEl) {
            console.error(`Section ${section} not found`);
            return false;
        }
        
        const inputs = sectionEl.querySelectorAll('[required]');
        inputs.forEach(input => {
            input.classList.remove('is-invalid');
            this.removeFieldError(input);
        });
        
        if (section === 5) {
            const hasExperienceYes = document.getElementById('hasExperienceYes');
            const hasExperienceNo = document.getElementById('hasExperienceNo');
            
            if (!hasExperienceYes.checked && !hasExperienceNo.checked) {
                isValid = false;
                const errorDiv = document.getElementById('experienceError');
                if (errorDiv) {
                    errorDiv.style.display = 'block';
                }
                return false;
            } else {
                const errorDiv = document.getElementById('experienceError');
                if (errorDiv) {
                    errorDiv.style.display = 'none';
                }
            }
            
            if (hasExperienceNo.checked) {
                return true;
            }
            
            if (hasExperienceYes.checked) {
                const experienceEntries = document.querySelectorAll('.experience-entry');
                if (experienceEntries.length === 0) {
                    this.showNotification('Please add at least one work experience', 'error');
                    return false;
                }
                
                experienceEntries.forEach((entry, index) => {
                    const requiredFields = entry.querySelectorAll('[required]');
                    requiredFields.forEach(field => {
                        const value = field.value.trim();
                        if (!value) {
                            isValid = false;
                            field.classList.add('is-invalid');
                            this.showFieldError(field, 'This field is required');
                        }
                    });
                });
            }
            
            return isValid;
        }
        
        inputs.forEach(input => {
            const value = input.value.trim();
            
            if (input.type === 'radio') {
                const radioName = input.name;
                const radioGroup = sectionEl.querySelectorAll(`input[name="${radioName}"]:checked`);
                if (radioGroup.length === 0) {
                    isValid = false;
                    const firstRadio = sectionEl.querySelector(`input[name="${radioName}"]`);
                    if (firstRadio) {
                        firstRadio.classList.add('is-invalid');
                        const errorDiv = document.getElementById(`${radioName}Error`) || 
                                       firstRadio.closest('.form-check')?.nextElementSibling;
                        if (errorDiv && errorDiv.classList.contains('invalid-feedback')) {
                            errorDiv.style.display = 'block';
                        }
                    }
                }
                return;
            }
            
            if (input.type === 'checkbox') {
                if (!input.checked && input.required) {
                    isValid = false;
                    input.classList.add('is-invalid');
                    this.showFieldError(input, 'You must agree to this term');
                }
                return;
            }
            
            if (!value) {
                isValid = false;
                input.classList.add('is-invalid');
                this.showFieldError(input, 'This field is required');
                return;
            }
            
            if (!this.validateFieldType(input, value)) {
                isValid = false;
            }
        });
        
        return isValid;
    }

    scrollToFirstInvalid() {
        const firstInvalid = document.querySelector('.is-invalid');
        if (firstInvalid) {
            firstInvalid.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
            
            setTimeout(() => {
                firstInvalid.focus();
            }, 500);
        }
    }

    updateProgress() {
        const progress = (this.currentSection / 6) * 100;
        const progressBar = document.getElementById('formProgress');
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
        
        document.querySelectorAll('.step').forEach((step, index) => {
            if (index < this.currentSection) {
                step.classList.add('active');
            } else {
                step.classList.remove('active');
            }
        });
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        if (!this.validateSection(6)) {
            this.showNotification('Please complete all required fields and accept terms', 'error');
            return;
        }
        
        this.showSummaryModal();
    }

    showSummaryModal() {
        const summaryContent = document.getElementById('summaryContent');
        if (!summaryContent) return;
        
        const formData = this.collectFormData();
        
        let html = `
            <div class="summary-section mb-4">
                <h6 class="text-primary"><i class="fas fa-user me-2"></i>Personal Information</h6>
                <div class="row">
                    <div class="col-md-6"><strong>Full Name:</strong> ${formData.personal.firstName} ${formData.personal.lastName}</div>
                    <div class="col-md-6"><strong>Contact:</strong> ${formData.personal.contactNumber}</div>
                    <div class="col-md-6"><strong>Date of Joining:</strong> ${formData.personal.dateOfJoining}</div>
                    <div class="col-md-6"><strong>Personal Email:</strong> ${formData.address.personalEmail}</div>
                    <div class="col-md-6"><strong>Company Email:</strong> ${formData.address.companyEmail}</div>
                    <div class="col-md-6"><strong>Aadhar:</strong> ${formData.identification.aadharNumber}</div>
                </div>
            </div>

            <div class="summary-section mb-4">
                <h6 class="text-primary"><i class="fas fa-building me-2"></i>Company Details</h6>
                <div class="row">
                    <div class="col-md-6"><strong>Branch:</strong> ${formData.company.branch}</div>
                    <div class="col-md-6"><strong>Department:</strong> ${formData.company.department}</div>
                    <div class="col-md-6"><strong>Designation:</strong> ${formData.company.designation}</div>
                    <div class="col-md-6"><strong>Report To:</strong> ${formData.company.reportTo}</div>
                </div>
            </div>
        `;
        
        if (formData.education && formData.education.length > 0) {
            html += `
                <div class="summary-section mb-4">
                    <h6 class="text-primary"><i class="fas fa-graduation-cap me-2"></i>Education Details</h6>
                    ${formData.education.map(edu => `
                        <div class="education-summary mb-2 p-2 bg-light rounded">
                            <strong>${edu.level}</strong> - ${edu.qualification}<br>
                            <small>${edu.instituteName}, ${edu.boardUniversity} (${edu.yearOfPassing})</small>
                            ${edu.specialization ? `<br><small>Specialization: ${edu.specialization}</small>` : ''}
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        if (formData.experience && formData.experience.length > 0) {
            html += `
                <div class="summary-section mb-4">
                    <h6 class="text-primary"><i class="fas fa-briefcase me-2"></i>Work Experience</h6>
                    ${formData.experience.map(exp => `
                        <div class="experience-summary mb-2 p-2 bg-light rounded">
                            <strong>${exp.designation}</strong> at ${exp.company}<br>
                            <small>${exp.fromDate} to ${exp.toDate || 'Present'}</small>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            html += `
                <div class="summary-section mb-4">
                    <h6 class="text-primary"><i class="fas fa-briefcase me-2"></i>Work Experience</h6>
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
                        No work experience provided
                    </div>
                </div>
            `;
        }
        
        html += `
            <div class="alert alert-success">
                <i class="fas fa-check-circle me-2"></i>
                All required information has been provided. Ready to submit.
            </div>
            
            <div class="text-center mt-4">
                <p class="text-muted">By submitting, you agree to all terms and conditions.</p>
            </div>
        `;
        
        summaryContent.innerHTML = html;
        
        const modalElement = document.getElementById('summaryModal');
        if (modalElement) {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        }
    }

    collectFormData() {
        return {
            personal: {
                salutation: document.getElementById('salutation')?.value || '',
                firstName: document.getElementById('firstName')?.value || '',
                lastName: document.getElementById('lastName')?.value || '',
                fullName: document.getElementById('fullName')?.value || '',
                fatherName: document.getElementById('fatherName')?.value || '',
                dateOfJoining: document.getElementById('dateOfJoining')?.value || '',
                contactNumber: document.getElementById('contactNumber')?.value || '',
                emailAddress: document.getElementById('emailAddress')?.value || '',
                gender: document.getElementById('gender')?.value || '',
                maritalStatus: document.getElementById('maritalStatus')?.value || '',
                dateOfBirth: document.getElementById('dateOfBirth')?.value || '',
                bloodGroup: document.getElementById('bloodGroup')?.value || ''
            },
            company: {
                branch: document.getElementById('branch')?.value || '',
                department: document.getElementById('department')?.value || '',
                designation: document.getElementById('designation')?.value || '',
                reportTo: document.getElementById('reportTo')?.value || ''
            },
            address: {
                personalEmail: document.getElementById('personalEmail')?.value || '',
                companyEmail: document.getElementById('companyEmail')?.value || '',
                currentAddress: document.getElementById('currentAddress')?.value || '',
                permanentAddress: document.getElementById('permanentAddress')?.value || '',
                country: document.getElementById('country')?.value || '',
                state: document.getElementById('state')?.value || '',
                district: document.getElementById('district')?.value || '',
                city: document.getElementById('city')?.value || '',
                pincode: document.getElementById('pincode')?.value || ''
            },
            identification: {
                aadharNumber: document.getElementById('aadharNumber')?.value || '',
                panNumber: document.getElementById('panNumber')?.value || '',
                passportNumber: document.getElementById('passportNumber')?.value || ''
            },
            education: this.collectEducationData(),
            experience: this.collectExperienceData(),
            other: {
                previousInterview: document.querySelector('input[name="previousInterview"]:checked')?.value || '',
                previousInterviewDetails: document.getElementById('previousPosition')?.value || '',
                criminalCase: document.querySelector('input[name="criminalCase"]:checked')?.value || '',
                criminalCaseDetails: document.getElementById('caseDetails')?.value || '',
                disability: document.querySelector('input[name="disability"]:checked')?.value || '',
                disabilityDetails: document.getElementById('disabilityDetail')?.value || '',
                esignature: document.getElementById('esignature')?.value || '',
                signatureDate: document.getElementById('signatureDate')?.value || '',
                signaturePlace: document.getElementById('signaturePlace')?.value || ''
            }
        };
    }

    collectEducationData() {
        const educationData = [];
        const entries = document.querySelectorAll('.education-entry');
        
        entries.forEach((entry, index) => {
            const level = entry.querySelector(`.education-level[data-index="${index}"]`)?.value || '';
            const qualification = entry.querySelector(`.qualification[data-index="${index}"]`)?.value || '';
            const yearOfPassing = entry.querySelector(`.year-of-passing[data-index="${index}"]`)?.value || '';
            const instituteName = entry.querySelector(`.institute-name[data-index="${index}"]`)?.value || '';
            const boardUniversity = entry.querySelector(`.board-university[data-index="${index}"]`)?.value || '';
            const percentage = entry.querySelector(`.percentage[data-index="${index}"]`)?.value || '';
            const specialization = entry.querySelector(`.specialization[data-index="${index}"]`)?.value || '';
            
            if (level || qualification || instituteName) {
                educationData.push({
                    level,
                    qualification,
                    yearOfPassing,
                    instituteName,
                    boardUniversity,
                    percentage,
                    specialization
                });
            }
        });
        
        return educationData;
    }

    collectExperienceData() {
        const experienceData = [];
        const entries = document.querySelectorAll('.experience-entry');
        
        entries.forEach((entry, index) => {
            const company = entry.querySelector(`.company[data-index="${index}"]`)?.value || '';
            const designation = entry.querySelector(`.designation[data-index="${index}"]`)?.value || '';
            const fromDate = entry.querySelector(`.from-date[data-index="${index}"]`)?.value || '';
            const toDate = entry.querySelector(`.to-date[data-index="${index}"]`)?.value || '';
            const experienceAddress = entry.querySelector(`.experience-address[data-index="${index}"]`)?.value || '';
            const companyContact = entry.querySelector(`.company-contact[data-index="${index}"]`)?.value || '';
            const ctc = entry.querySelector(`.ctc[data-index="${index}"]`)?.value || '';
            const reasonForLeaving = entry.querySelector(`.reason-for-leaving[data-index="${index}"]`)?.value || '';
            
            if (company || designation) {
                experienceData.push({
                    company,
                    designation,
                    fromDate,
                    toDate,
                    experienceAddress,
                    companyContact,
                    ctc,
                    reasonForLeaving
                });
            }
        });
        
        return experienceData;
    }

   async submitApplication(submitButton) {
    const button = submitButton || document.querySelector('#summaryModal .btn.btn-primary');
    const originalContent = button ? button.innerHTML : '';

    try {
        if (button) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Submitting...';
        }

        const formData = this.collectFormData();
        const apiBaseUrl = (window.API_BASE_URL || '').replace(/\/$/, '');
        const response = await fetch(`${apiBaseUrl}/api/employees`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Failed to save employee data');
        }

        const modalElement = document.getElementById('summaryModal');
        if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) {
                modal.hide();
            }
        }

        this.showNotification('Application submitted and saved to Excel successfully!', 'success');
        this.resetForm();
    } catch (error) {
        console.error('Submission error:', error);
        this.showNotification(error.message || 'Error submitting application', 'error');
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = originalContent;
        }
    }
}



createCSVRow(formData, eduIndex, expIndex, includeBasicAndCompany = true) {
    const row = [];

    // ================= BASIC + COMPANY =================
    if (includeBasicAndCompany) {

        row.push(
            formData.personal.salutation,
            formData.personal.firstName,
            formData.personal.lastName,
            formData.personal.fullName,
            formData.personal.fatherName,
            formData.personal.dateOfJoining,
            formData.personal.contactNumber,
            formData.personal.emailAddress,
            formData.personal.gender,
            formData.personal.maritalStatus,
            formData.personal.dateOfBirth,
            formData.personal.bloodGroup,

            formData.company.branch,
            formData.company.department,
            formData.company.designation,
            formData.company.reportTo,

            formData.address.personalEmail,
            formData.address.companyEmail,
            formData.address.currentAddress,
            formData.address.permanentAddress,
            formData.address.country,
            formData.address.state,
            formData.address.district,
            formData.address.city,
            formData.address.pincode,

            formData.identification.aadharNumber,
            formData.identification.panNumber,
            formData.identification.passportNumber,

            formData.other.previousInterview,
            formData.other.previousInterviewDetails,
            formData.other.criminalCase,
            formData.other.criminalCaseDetails,
            formData.other.disability,
            formData.other.disabilityDetails,
            formData.other.esignature,
            formData.other.signatureDate,
            formData.other.signaturePlace
        );

    } else {
        // 37 blank columns
        for (let i = 0; i < 37; i++) row.push('');
    }


    // ================= EDUCATION =================
    if (formData.education[eduIndex]) {
        const edu = formData.education[eduIndex];

        row.push(
            edu.level,
            edu.qualification,
            edu.yearOfPassing,
            edu.instituteName,
            edu.boardUniversity,
            edu.percentage,
            edu.specialization
        );
    } else {
        for (let i = 0; i < 7; i++) row.push('');
    }


    // ================= EXPERIENCE =================
    if (formData.experience[expIndex]) {
        const exp = formData.experience[expIndex];

        row.push(
            exp.company,
            exp.designation,
            exp.fromDate,
            exp.toDate,
            exp.experienceAddress,
            exp.companyContact,
            exp.ctc,
            exp.reasonForLeaving
        );
    } else {
        for (let i = 0; i < 8; i++) row.push('');
    }

    return row.map(v => this.escapeCSV(v)).join(',');
}



escapeCSV(value) {
    if (!value) return '';
    value = String(value);

    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}


    resetForm() {
        const form = document.getElementById('onboardingForm');
        if (form) {
            form.reset();
        }
        
        this.currentSection = 1;
        this.educationCount = 1;
        this.experienceCount = 0;
        
        // Reset UI sections
        document.querySelectorAll('.form-section').forEach((section, index) => {
            section.style.display = index === 0 ? 'block' : 'none';
        });
        
        // Clear education container except first entry
        const educationContainer = document.getElementById('educationContainer');
        if (educationContainer) {
            const firstEntry = educationContainer.querySelector('.education-entry');
            educationContainer.innerHTML = '';
            if (firstEntry) {
                // Reset the index to 0
                const clonedEntry = firstEntry.cloneNode(true);
                clonedEntry.querySelectorAll('[data-index]').forEach(el => {
                    el.dataset.index = '0';
                });
                
                // Reset delete button
                const deleteBtn = clonedEntry.querySelector('.btn-danger');
                if (deleteBtn) {
                    deleteBtn.setAttribute('onclick', 'onboardingForm.removeEducationEntry(0)');
                }
                
                educationContainer.appendChild(clonedEntry);
            }
        }
        
        // Clear experience container
        const experienceContainer = document.getElementById('experienceContainer');
        if (experienceContainer) {
            experienceContainer.innerHTML = '';
        }
        
        // Hide experience section
        const addExperienceBtn = document.getElementById('addExperienceBtn');
        if (addExperienceBtn) {
            addExperienceBtn.style.display = 'none';
        }
        
        // Reset work experience radio
        const hasExperienceNo = document.getElementById('hasExperienceNo');
        if (hasExperienceNo) {
            hasExperienceNo.checked = true;
        }
        
        // Hide conditional fields
        document.getElementById('previousInterviewDetails').style.display = 'none';
        document.getElementById('criminalCaseDetails').style.display = 'none';
        document.getElementById('disabilityDetails').style.display = 'none';
        
        // Reset progress
        this.updateProgress();
        
        // Reset floating labels
        setTimeout(() => {
            this.initializeFloatingLabels();
        }, 100);
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Show success message
        this.showNotification('Form reset successfully. Ready for new employee entry.', 'success');
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        document.querySelectorAll('.notification').forEach(n => n.remove());
        
        // Create custom notification
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        // Set background color based on type
        const colors = {
            success: '#10b981',
            error: '#dc3545',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        
        notification.style.background = colors[type] || colors.info;
        
        // Add icon
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        
        notification.innerHTML = `
            <i class="fas ${icons[type] || icons.info} me-2"></i>
            <span>${message}</span>
            <button class="btn-close btn-close-white ms-auto" style="background:transparent; border:none; color:white; font-size:12px;"></button>
        `;
        
        document.body.appendChild(notification);
        
        // Add close button event
        const closeBtn = notification.querySelector('.btn-close');
        closeBtn.addEventListener('click', () => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        });
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (document.body.contains(notification)) {
                notification.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }
}

// Initialize the form when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.onboardingForm = new OnboardingForm();
    console.log('Onboarding Form initialized with correct CSV structure');
});
