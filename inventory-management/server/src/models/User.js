const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Full name is required'], trim: true, maxlength: 100 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address'],
    },
    // Mobile number (10 digits, stored without country code). Optional; lets a user sign in with phone + password.
    phone: { type: String, trim: true, unique: true, sparse: true, match: [/^[6-9]\d{9}$/, 'Please enter a valid 10-digit mobile number'] },
    password: { type: String, required: true, minlength: 8, select: false },
    // Roles are stored now so permissions can be layered on later without a migration.
    role: { type: String, trim: true, lowercase: true, match: /^[a-z][a-z0-9 _-]*$/, default: 'user' },
    department: { type: String, trim: true, default: 'General', maxlength: 80 },
    departmentRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
    employeeId: { type: String, trim: true, default: '', maxlength: 50 },
    jobTitle: { type: String, trim: true, default: '', maxlength: 100 },
    designation: { type: String, trim: true, default: '', maxlength: 100 },
    employmentType: { type: String, enum: ['full_time', 'part_time', 'contract', 'intern'], default: 'full_time' },
    dateOfJoining: { type: Date, default: null },
    joiningDate: { type: Date, default: null },
    dateOfExit: { type: Date, default: null },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    reportingManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    workLocation: { type: String, trim: true, default: '', maxlength: 120 },
    branch: { type: String, trim: true, default: '', maxlength: 120 },
    emergencyContact: { type: String, trim: true, default: '', maxlength: 40 },
    dateOfBirth: { type: Date, default: null },
    address: { type: String, trim: true, default: '', maxlength: 500 },
    profilePhoto: { type: String, trim: true, default: '', maxlength: 500 },
    salaryCurrency: { type: String, trim: true, uppercase: true, default: 'INR', maxlength: 3 },
    salaryStructure: {
      basicSalary: { type: Number, min: 0, default: 0 },
      hra: { type: Number, min: 0, default: 0 },
      allowances: { type: Number, min: 0, default: 0 },
      bonus: { type: Number, min: 0, default: 0 },
      overtimeRate: { type: Number, min: 0, default: 0 },
      deductions: { type: Number, min: 0, default: 0 },
    },
    status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
    // Incrementing this invalidates every JWT issued before (logout everywhere / password reset).
    tokenVersion: { type: Number, default: 0, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    lastLoginAt: Date,
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, BCRYPT_ROUNDS);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    phone: this.phone || '',
    role: this.role,
    department: this.department || 'General',
    departmentRef: this.departmentRef || null,
    employeeId: this.employeeId || '',
    jobTitle: this.jobTitle || '',
    employmentType: this.employmentType || 'full_time',
    dateOfJoining: this.dateOfJoining || null,
    dateOfExit: this.dateOfExit || null,
    manager: this.manager || null,
    workLocation: this.workLocation || '',
    salaryCurrency: this.salaryCurrency || 'INR',
    status: this.status,
    permissions: this._accessPermissions || [],
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
