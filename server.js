const express = require('express');
const ExcelJS = require('exceljs');
const crypto = require('crypto');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

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

function getDbConfig() {
    const sslDisabled = String(process.env.PGSSL || '').toLowerCase() === 'false' ||
        String(process.env.PGSSLMODE || '').toLowerCase() === 'disable';
    const fallbackPassword = process.env.PGPASSWORD !== undefined ? String(process.env.PGPASSWORD) : 'invalid-password';

    if (process.env.DATABASE_URL) {
        let parsedConfig = null;
        try {
            const parsedUrl = new URL(process.env.DATABASE_URL);
            parsedConfig = {
                host: parsedUrl.hostname,
                port: Number(parsedUrl.port || 5432),
                user: decodeURIComponent(parsedUrl.username || process.env.PGUSER || 'postgres'),
                password: decodeURIComponent(parsedUrl.password || fallbackPassword),
                database: decodeURIComponent((parsedUrl.pathname || '/').replace(/^\//, '') || process.env.PGDATABASE || 'TeamDesk-db')
            };
        } catch (_error) {
            parsedConfig = null;
        }

        if (parsedConfig) {
            return {
                ...parsedConfig,
                ssl: sslDisabled ? false : { rejectUnauthorized: false }
            };
        }
    }

    return {
        host: process.env.PGHOST || 'localhost',
        port: Number(process.env.PGPORT || 5432),
        user: process.env.PGUSER || 'postgres',
        password: fallbackPassword,
        database: process.env.PGDATABASE || 'TeamDesk-db',
        ssl: sslDisabled ? false : undefined
    };
}

const pool = new Pool(getDbConfig());

function hashPassword(password) {
    return crypto.createHash('sha256').update(String(password)).digest('hex');
}

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

function rowsToObjects(rows2D) {
    return rows2D.map((row) => {
        const obj = {};
        HEADERS.forEach((header, index) => {
            obj[header] = row[index] || '';
        });
        return obj;
    });
}

async function initDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS employee_submissions (
            id BIGSERIAL PRIMARY KEY,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            form_data JSONB NOT NULL
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_users (
            username TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await pool.query(
        `
        INSERT INTO admin_users (username, password_hash)
        VALUES ($1, $2)
        ON CONFLICT (username) DO NOTHING
        `,
        [ADMIN_USERNAME, hashPassword(ADMIN_PASSWORD)]
    );
}

async function getAdminByUsername(username) {
    const result = await pool.query(
        `SELECT username, password_hash FROM admin_users WHERE username = $1 LIMIT 1`,
        [username]
    );
    return result.rows[0] || null;
}

async function saveSubmission(formData) {
    const query = `
        INSERT INTO employee_submissions (form_data)
        VALUES ($1::jsonb)
        RETURNING id, created_at
    `;
    const result = await pool.query(query, [JSON.stringify(formData)]);
    return result.rows[0];
}

async function fetchAllSubmissions() {
    const query = `
        SELECT id, created_at, form_data
        FROM employee_submissions
        ORDER BY id ASC
    `;
    const result = await pool.query(query);
    return result.rows;
}

function toStringSafe(value) {
    return value === null || value === undefined ? '' : String(value);
}

async function getFlattenedEntries() {
    const submissions = await fetchAllSubmissions();
    const allRowObjects = [];

    submissions.forEach((submission) => {
        const formData = submission.form_data || {};
        const rows = buildRows(formData);
        const rowObjects = rowsToObjects(rows);
        allRowObjects.push(...rowObjects);
    });

    return {
        headers: HEADERS,
        rows: allRowObjects
    };
}

async function getAdminSubmissionList() {
    const submissions = await fetchAllSubmissions();

    return submissions.map((submission) => {
        const formData = submission.form_data || {};
        const personal = formData.personal || {};
        const company = formData.company || {};

        return {
            id: submission.id,
            createdAt: submission.created_at,
            fullName: toStringSafe(personal.fullName || `${personal.firstName || ''} ${personal.lastName || ''}`.trim()),
            email: toStringSafe(personal.emailAddress || formData.address?.personalEmail || ''),
            department: toStringSafe(company.department || ''),
            designation: toStringSafe(company.designation || ''),
            formData
        };
    });
}

app.get('/api/health', async (_req, res) => {
    try {
        await pool.query('SELECT 1');
        return res.json({ ok: true, database: 'connected' });
    } catch (_error) {
        return res.status(500).json({ ok: false, database: 'disconnected' });
    }
});

app.get('/admin/login', (_req, res) => {
    res.sendFile(require('path').join(__dirname, 'admin-login.html'));
});

app.get('/admin/dashboard', (_req, res) => {
    res.sendFile(require('path').join(__dirname, 'admin.html'));
});

app.post('/api/admin/login', (req, res) => {
    (async () => {
        const { username, password } = req.body || {};
        const admin = await getAdminByUsername(username);

        if (!admin || admin.password_hash !== hashPassword(password)) {
            return res.status(401).json({
                success: false,
                message: 'Invalid username or password'
            });
        }

        const now = Math.floor(Date.now() / 1000);
        const token = signToken({
            username: admin.username,
            role: 'admin',
            iat: now,
            exp: now + ADMIN_TOKEN_TTL_SECONDS
        });

        return res.json({
            success: true,
            token,
            expiresInSeconds: ADMIN_TOKEN_TTL_SECONDS
        });
    })().catch((error) => {
        console.error('Admin login failed:', error);
        return res.status(500).json({
            success: false,
            message: 'Login failed'
        });
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
        const { headers, rows } = await getFlattenedEntries();
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
            message: 'Failed to read data from database'
        });
    }
});

app.get('/api/admin/submissions', requireAdminAuth, async (_req, res) => {
    try {
        const rows = await getAdminSubmissionList();
        return res.json({
            success: true,
            rows,
            totalRows: rows.length
        });
    } catch (error) {
        console.error('Failed to read submissions:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to read submissions from database'
        });
    }
});

app.get('/api/admin/download-excel', requireAdminAuth, async (_req, res) => {
    try {
        const { rows } = await getFlattenedEntries();

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(SHEET_NAME);

        worksheet.addRow(HEADERS);
        rows.forEach((rowObj) => {
            worksheet.addRow(HEADERS.map((header) => rowObj[header] || ''));
        });

        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="employee_data.xlsx"');

        await workbook.xlsx.write(res);
        return res.end();
    } catch (error) {
        console.error('Failed to download excel:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to generate Excel file'
        });
    }
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

        const saved = await saveSubmission(formData);

        return res.status(201).json({
            success: true,
            message: 'Employee data saved to database successfully',
            submissionId: saved.id,
            createdAt: saved.created_at
        });
    } catch (error) {
        console.error('Failed to save employee data:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to save employee data to database'
        });
    }
});

async function startServer() {
    try {
        await initDatabase();
        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
            console.log(`Database connected`);
            console.log(`Admin login: http://localhost:${PORT}/admin/login`);
        });
    } catch (error) {
        console.error('Failed to initialize database:', error);
        console.error(
            'DB config check: set DATABASE_URL or PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD'
        );
        process.exit(1);
    }
}

startServer();

