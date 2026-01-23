#!/usr/bin/env node

/**
 * Script to seed the database with test clients
 * 
 * Usage: node scripts/seed-clients.js
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;
const ENCRYPT_KEY_SECRET = process.env.ENCRYPT_KEY_SECRET;
const DB_PREFIX = process.env.DB_PREFIX;

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const PREFIX = 'enc:v1:';

if (!MONGODB_URI) {
  console.error('MONGODB_URI not found in .env.local');
  process.exit(1);
}

if (!ENCRYPT_KEY_SECRET) {
  console.error('ENCRYPT_KEY_SECRET not found in .env.local');
  process.exit(1);
}

// Get encryption key (same as app)
function getKey() {
  return crypto.createHash('sha256').update(ENCRYPT_KEY_SECRET).digest();
}

// Encryption helper - NEW FORMAT (same as app)
function encrypt(text) {
  if (!text) return text;
  
  try {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(Buffer.from(text, 'utf8')),
      cipher.final()
    ]);
    
    const tag = cipher.getAuthTag();
    
    // Combine: IV (12 bytes) + Auth Tag (16 bytes) + Ciphertext
    const payload = Buffer.concat([iv, tag, encrypted]).toString('base64');
    
    return `${PREFIX}${payload}`;
  } catch (error) {
    console.error('Encryption failed:', error);
    throw error;
  }
}

// Create blind index (same as app)
function createBlindIndex(value) {
  if (!value) return '';
  const normalized = value.toLowerCase().trim();
  return crypto
    .createHmac('sha256', ENCRYPT_KEY_SECRET)
    .update(normalized)
    .digest('hex');
}

// Client Schema
const clientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  nameIndex: { type: String, index: true },
  phone: { type: String },
  phoneIndex: { type: String, index: true },
  email: { type: String },
  emailIndex: { type: String, index: true },
  address: { type: String },
  active: { type: Boolean, default: true },
}, { timestamps: true });

const Client = mongoose.model('Client', clientSchema, `${DB_PREFIX}clients`);

const clients = [
  { name: 'Empresa ABC Ltda', phone: '(11) 99999-1111', email: 'contato@abc.com.br', address: 'Rua das Flores, 123 - São Paulo, SP' },
  { name: 'Tech Solutions SA', phone: '(11) 99999-2222', email: 'contato@techsolutions.com.br', address: 'Av. Paulista, 1000 - São Paulo, SP' },
  { name: 'Comércio XYZ', phone: '(11) 99999-3333', email: 'vendas@xyz.com.br', address: 'Rua do Comércio, 456 - São Paulo, SP' },
  { name: 'Consultoria Beta', phone: '(21) 99999-4444', email: 'info@beta.com.br', address: 'Praia de Botafogo, 300 - Rio de Janeiro, RJ' },
  { name: 'Indústria Gama', phone: '(31) 99999-5555', email: 'industria@gama.com.br', address: 'Av. do Contorno, 2000 - Belo Horizonte, MG' },
  { name: 'Startup Inovação', phone: '(41) 99999-6666', email: 'hello@inovacao.io', address: 'Rua XV de Novembro, 500 - Curitiba, PR' },
  { name: 'Agência Criativa', phone: '(51) 99999-7777', email: 'ola@criativa.ag', address: 'Av. Borges de Medeiros, 800 - Porto Alegre, RS' },
  { name: 'E-commerce Plus', phone: '(85) 99999-8888', email: 'suporte@ecommerceplus.com.br', address: 'Av. Beira Mar, 1500 - Fortaleza, CE' },
  { name: 'Advocacia Silva', phone: '(61) 99999-9999', email: 'contato@silvaadvogados.com.br', address: 'SCS Quadra 01, Bloco A - Brasília, DF' },
  { name: 'Clínica Saúde', phone: '(71) 99999-0000', email: 'atendimento@clinicasaude.com.br', address: 'Av. Tancredo Neves, 600 - Salvador, BA' },
  { name: 'Restaurante Sabor', phone: '(48) 99998-1111', email: 'reservas@sabor.com.br', address: 'Rua Bocaiúva, 200 - Florianópolis, SC' },
  { name: 'Imobiliária Casa Nova', phone: '(62) 99998-2222', email: 'vendas@casanova.com.br', address: 'Av. T-63, 1200 - Goiânia, GO' },
];

async function seedClients() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!');
    
    console.log('\nSeeding clients...');
    
    for (const clientData of clients) {
      const nameIndex = createBlindIndex(clientData.name);
      const existingClient = await Client.findOne({ nameIndex });
      
      if (existingClient) {
        console.log(`  ⚠️  Client "${clientData.name}" already exists, skipping...`);
        continue;
      }
      
      const client = new Client({
        name: encrypt(clientData.name),
        nameIndex,
        phone: clientData.phone ? encrypt(clientData.phone) : undefined,
        phoneIndex: clientData.phone ? createBlindIndex(clientData.phone) : undefined,
        email: clientData.email ? encrypt(clientData.email) : undefined,
        emailIndex: clientData.email ? createBlindIndex(clientData.email) : undefined,
        address: clientData.address ? encrypt(clientData.address) : undefined,
        active: true,
      });
      
      await client.save();
      console.log(`  ✅ Created client: ${clientData.name}`);
    }
    
    console.log('\n✅ Clients seeded successfully!');
    
  } catch (error) {
    console.error('Error seeding clients:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedClients();
