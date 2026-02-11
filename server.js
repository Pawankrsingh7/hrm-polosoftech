const express = require('express');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

const DATA_DIR = path.join(__dirname, 'data');
const EXCEL_FILE_PATH = path.join(DATA_DIR, 'employee_data.xlsx');
const SHEET_NAME = 'Employees';

const HEADERS = [
    'Salutation',
    'First Name',
    'Last Name',
    'Full Name',
    "Father\'s Name",
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
    'Previous Interview',
    'Previous Interview Details',
    'Criminal Case',
    'Criminal Case Details',
    'Disability',
    'Disability Details',
    'E-Signature',
    'Signature Date',
    'Signature Place',
    'Education Level',
    'Qualification',
    'Year of Passing',
    'Institute Name',
    'Board/University',
    'Percentage',
    'Specialization',
    'Company',
    'Job Designation',
    'From Date',
    'To Date',
    'Company Address',
    'Company Contact',
    'CTC (Annual)',
    'Reason for Leaving'
];

app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    return next();
});
app.use(express.static(__dirname));

let isWriting = false;
const writeQueue = [];

function queueWrite(task) {
    return new Promise((resolve, reject) => {
        writeQueue.push({ task, resolve, reject });
        processWriteQueue();
    });
}

async function processWriteQueue() {
    if (isWriting || writeQueue.length === 0) {
        return;
    }

    isWriting = true;
    const job = writeQueue.shift();

    try {
        const result = await job.task();
        job.resolve(result);
    } catch (error) {
        job.reject(error);
    } finally {
        isWriting = false;
        processWriteQueue();
    }
}

function ensureDataDirectory() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

async function loadWorkbook() {
    ensureDataDirectory();

    const workbook = new ExcelJS.Workbook();
    if (fs.existsSync(EXCEL_FILE_PATH)) {
        await workbook.xlsx.readFile(EXCEL_FILE_PATH);
    }

    let sheet = workbook.getWorksheet(SHEET_NAME);
    if (!sheet) {
        sheet = workbook.addWorksheet(SHEET_NAME);
    }

    if (sheet.rowCount === 0) {
        const headerRow = sheet.addRow(HEADERS);
        headerRow.font = { bold: true };
    }

    return { workbook, sheet };
}

function buildRow(formData, eduIndex, expIndex, includeMainData) {
    const row = [];
    const personal = formData.personal || {};
    const company = formData.company || {};
    const address = formData.address || {};
    const identification = formData.identification || {};
    const other = formData.other || {};
    const education = Array.isArray(formData.education) ? formData.education : [];
    const experience = Array.isArray(formData.experience) ? formData.experience : [];

    if (includeMainData) {
        row.push(
            personal.salutation || '',
            personal.firstName || '',
            personal.lastName || '',
            personal.fullName || '',
            personal.fatherName || '',
            personal.dateOfJoining || '',
            personal.contactNumber || '',
            personal.emailAddress || '',
            personal.gender || '',
            personal.maritalStatus || '',
            personal.dateOfBirth || '',
            personal.bloodGroup || '',
            company.branch || '',
            company.department || '',
            company.designation || '',
            company.reportTo || '',
            address.personalEmail || '',
            address.companyEmail || '',
            address.currentAddress || '',
            address.permanentAddress || '',
            address.country || '',
            address.state || '',
            address.district || '',
            address.city || '',
            address.pincode || '',
            identification.aadharNumber || '',
            identification.panNumber || '',
            identification.passportNumber || '',
            other.previousInterview || '',
            other.previousInterviewDetails || '',
            other.criminalCase || '',
            other.criminalCaseDetails || '',
            other.disability || '',
            other.disabilityDetails || '',
            other.esignature || '',
            other.signatureDate || '',
            other.signaturePlace || ''
        );
    } else {
        for (let i = 0; i < 37; i += 1) {
            row.push('');
        }
    }

    const edu = education[eduIndex];
    if (edu) {
        row.push(
            edu.level || '',
            edu.qualification || '',
            edu.yearOfPassing || '',
            edu.instituteName || '',
            edu.boardUniversity || '',
            edu.percentage || '',
            edu.specialization || ''
        );
    } else {
        for (let i = 0; i < 7; i += 1) {
            row.push('');
        }
    }

    const exp = experience[expIndex];
    if (exp) {
        row.push(
            exp.company || '',
            exp.designation || '',
            exp.fromDate || '',
            exp.toDate || '',
            exp.experienceAddress || '',
            exp.companyContact || '',
            exp.ctc || '',
            exp.reasonForLeaving || ''
        );
    } else {
        for (let i = 0; i < 8; i += 1) {
            row.push('');
        }
    }

    return row;
}

function buildRows(formData) {
    const education = Array.isArray(formData.education) ? formData.education : [];
    const experience = Array.isArray(formData.experience) ? formData.experience : [];
    const rows = [];

    rows.push(buildRow(formData, 0, 0, true));

    const maxRows = Math.max(education.length, experience.length);
    for (let i = 1; i < maxRows; i += 1) {
        rows.push(buildRow(formData, i, i, false));
    }

    return rows;
}

async function appendEmployeeToWorkbook(formData) {
    const { workbook, sheet } = await loadWorkbook();
    const rows = buildRows(formData);

    rows.forEach((row) => {
        sheet.addRow(row);
    });

    await workbook.xlsx.writeFile(EXCEL_FILE_PATH);

    return {
        rowsAdded: rows.length,
        filePath: EXCEL_FILE_PATH
    };
}

app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
});

app.post('/api/employees', async (req, res) => {
    try {
        const formData = req.body || {};
        const firstName = formData.personal?.firstName;
        const contactNumber = formData.personal?.contactNumber;

        if (!firstName || !contactNumber) {
            return res.status(400).json({
                success: false,
                message: 'Missing required employee details'
            });
        }

        const result = await queueWrite(() => appendEmployeeToWorkbook(formData));

        return res.status(201).json({
            success: true,
            message: 'Employee data saved to Excel successfully',
            rowsAdded: result.rowsAdded,
            file: path.basename(result.filePath)
        });
    } catch (error) {
        console.error('Failed to save employee data:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to save employee data to Excel'
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Excel output path: ${EXCEL_FILE_PATH}`);
});
