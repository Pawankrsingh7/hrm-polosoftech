const express = require('express');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

const DATA_DIR = path.join(__dirname, 'data');
const EXCEL_FILE_PATH = path.join(DATA_DIR, 'employee_data.xlsx');
const SHEET_NAME = 'Employees';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET || 'change-this-secret-in-production';
const ADMIN_TOKEN_TTL_SECONDS = 60 * 60 * 12; // 12 hours

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
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    return next();
});
app.use(express.static(__dirname));

function toBase64Url(value) {
    return Buffer.from(value).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value) {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
    return Buffer.from(padded, 'base64').toString('utf8');
}

function signToken(payloadObject) {
    const payload = JSON.stringify(payloadObject);
    const payloadEncoded = toBase64Url(payload);
    const signature = crypto.createHmac('sha256', ADMIN_TOKEN_SECRET).update(payloadEncoded).digest('hex');
    return `${payloadEncoded}.${signature}`;
}

function verifyToken(token) {
    if (!token || typeof token !== 'string' || !token.includes('.')) {
        return null;
    }

    const [payloadEncoded, signature] = token.split('.');
    if (!payloadEncoded || !signature) {
        return null;
    }

    const expectedSignature = crypto.createHmac('sha256', ADMIN_TOKEN_SECRET).update(payloadEncoded).digest('hex');
    if (signature.length !== expectedSignature.length) {
        return null;
    }

    const providedBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
        return null;
    }

    try {
        const payload = JSON.parse(fromBase64Url(payloadEncoded));
        if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }
        return payload;
    } catch (_error) {
        return null;
    }
}

function requireAdminAuth(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const payload = verifyToken(token);

    if (!payload) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized'
        });
    }

    req.admin = payload;
    return next();
}

function normalizeCellValue(cellValue) {
    if (cellValue === null || cellValue === undefined) {
        return '';
    }

    if (cellValue instanceof Date) {
        return cellValue.toISOString().slice(0, 10);
    }

    if (typeof cellValue === 'object') {
        if (Object.prototype.hasOwnProperty.call(cellValue, 'result')) {
            return String(cellValue.result || '');
        }
        if (Object.prototype.hasOwnProperty.call(cellValue, 'text')) {
            return String(cellValue.text || '');
        }
    }

    return String(cellValue);
}

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

async function readWorkbookEntries() {
    ensureDataDirectory();

    if (!fs.existsSync(EXCEL_FILE_PATH)) {
        return {
            headers: HEADERS,
            rows: []
        };
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(EXCEL_FILE_PATH);

    const sheet = workbook.getWorksheet(SHEET_NAME);
    if (!sheet || sheet.rowCount === 0) {
        return {
            headers: HEADERS,
            rows: []
        };
    }

    const firstRow = sheet.getRow(1);
    const headers = [];
    for (let i = 1; i <= HEADERS.length; i += 1) {
        headers.push(normalizeCellValue(firstRow.getCell(i).value) || HEADERS[i - 1]);
    }

    const rows = [];
    for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex += 1) {
        const row = sheet.getRow(rowIndex);
        const rowObject = {};
        let hasAnyValue = false;

        for (let colIndex = 1; colIndex <= headers.length; colIndex += 1) {
            const cellValue = normalizeCellValue(row.getCell(colIndex).value);
            if (cellValue !== '') {
                hasAnyValue = true;
            }
            rowObject[headers[colIndex - 1]] = cellValue;
        }

        if (hasAnyValue) {
            rows.push(rowObject);
        }
    }

    return { headers, rows };
}

app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
});

app.get('/admin/login', (_req, res) => {
    res.sendFile(path.join(__dirname, 'admin-login.html'));
});

app.get('/admin/dashboard', (_req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body || {};

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
        return res.status(401).json({
            success: false,
            message: 'Invalid username or password'
        });
    }

    const now = Math.floor(Date.now() / 1000);
    const token = signToken({
        username,
        role: 'admin',
        iat: now,
        exp: now + ADMIN_TOKEN_TTL_SECONDS
    });

    return res.json({
        success: true,
        token,
        expiresInSeconds: ADMIN_TOKEN_TTL_SECONDS
    });
});

app.get('/api/admin/me', requireAdminAuth, (req, res) => {
    res.json({
        success: true,
        admin: {
            username: req.admin.username,
            role: req.admin.role
        }
    });
});

app.get('/api/admin/entries', requireAdminAuth, async (_req, res) => {
    try {
        const { headers, rows } = await readWorkbookEntries();
        return res.json({
            success: true,
            headers,
            rows,
            totalRows: rows.length
        });
    } catch (error) {
        console.error('Failed to read entries:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to read Excel data'
        });
    }
});

app.get('/api/admin/download-excel', requireAdminAuth, (req, res) => {
    if (!fs.existsSync(EXCEL_FILE_PATH)) {
        return res.status(404).json({
            success: false,
            message: 'No Excel file found yet'
        });
    }

    return res.download(EXCEL_FILE_PATH, 'employee_data.xlsx');
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
    console.log(`Admin login: http://localhost:${PORT}/admin/login`);
});
