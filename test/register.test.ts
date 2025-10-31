import { test, beforeAll, afterAll, expect } from 'vitest';
import { build } from '../src/server.js';
import { prisma } from '../src/lib/prisma.js';
import { Wallet, ethers } from 'ethers';

// Helper to generate a random wallet
const generateWallet = () => {
  return Wallet.createRandom();
};

// Helper to sign a message
const signMessage = async (privateKey: string, message: string) => {
  const wallet = new Wallet(privateKey);
  return await wallet.signMessage(message);
};

let app;
let wallet: Wallet;
let message;
let signature;

beforeAll(async () => {
  app = await build();
  await app.listen({ port: 0 }); // Listen on a random port

  wallet = generateWallet();
  message = 'Sign this message to register your wallet.';
  signature = await signMessage(wallet.privateKey, message);
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

test('should reject registration with email or password', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/register',
    payload: {
      walletAddress: wallet.address,
      message: message,
      signature: signature,
      email: 'test@example.com',
      password: 'password123',
    },
  });

  expect(response.statusCode).toBe(400);
  expect(response.json()).toEqual({
    statusCode: 400,
    message: 'Traditional authentication not supported',
    code: 'TRADITIONAL_AUTH_NOT_SUPPORTED',
  });
});

test('should register a new user with wallet authentication', async () => {
  const newWallet = generateWallet();
  const newMessage = 'Sign this message to register your wallet.';
  const newSignature = await signMessage(newWallet.privateKey, newMessage);

  const response = await app.inject({
    method: 'POST',
    url: '/register',
    payload: {
      walletAddress: newWallet.address,
      message: newMessage,
      signature: newSignature,
    },
  });

  expect(response.statusCode).toBe(201);
  expect(response.json()).toHaveProperty('userId');
  expect(response.json().message).toBe('User registered successfully');
});

test('should return 200 if user already registered', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/register',
    payload: {
      walletAddress: wallet.address,
      message: message,
      signature: signature,
    },
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toHaveProperty('userId');
  expect(response.json().message).toBe('User already registered');
});

// Test for invalid wallet address format
test('should return 400 for invalid wallet address format', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/register',
    payload: {
      walletAddress: 'invalid-address',
      message: message,
      signature: signature,
    },
  });

  expect(response.statusCode).toBe(400);
  expect(response.json()).toEqual({
    statusCode: 400,
    code: 'FST_ERR_VALIDATION',
    message: 'body/walletAddress must match pattern "^0x[a-fA-F0-9]{40}$"'
  });
});

// Test for missing message
test('should return 400 for missing message', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/register',
    payload: {
      walletAddress: wallet.address,
      signature: signature,
    },
  });

  expect(response.statusCode).toBe(400);
  expect(response.json()).toEqual({
    statusCode: 400,
    code: 'FST_ERR_VALIDATION',
    message: 'body must have required property \'message\''
  });
});

// Test for missing signature
test('should return 400 for missing signature', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/register',
    payload: {
      walletAddress: wallet.address,
      message: message,
    },
  });

  expect(response.statusCode).toBe(400);
  expect(response.json()).toEqual({
    statusCode: 400,
    code: 'FST_ERR_VALIDATION',
    message: 'body must have required property \'signature\''
  });
});

// Test for invalid signature format
test('should return 400 for invalid signature format', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/register',
    payload: {
      walletAddress: wallet.address,
      message: message,
      signature: 'invalid-signature',
    },
  });

  expect(response.statusCode).toBe(400);
  expect(response.json()).toEqual({
    statusCode: 400,
    code: 'FST_ERR_VALIDATION',
    message: 'body/signature must match pattern "^0x[a-fA-F0-9]{130}$"'
  });
});

// Test for incorrect signature (preHandler will catch this)
test('should return 401 for incorrect signature', async () => {
  const wrongWallet = generateWallet();
  const wrongSignature = await signMessage(wrongWallet.privateKey, message);

  const response = await app.inject({
    method: 'POST',
    url: '/register',
    payload: {
      walletAddress: wallet.address,
      message: message,
      signature: wrongSignature,
    },
  });

  expect(response.statusCode).toBe(401);
  expect(response.json()).toEqual({
    statusCode: 401,
    code: 'UNAUTHORIZED',
    message: 'Invalid wallet signature',
  });
});
