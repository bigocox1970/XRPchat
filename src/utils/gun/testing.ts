import { gun, getConnectionStatus } from './client';
import { createGunUser, authenticateGunUser } from './auth';
import { createGunThread, sendGunMessage } from './chat';
import { addGunContact } from './contacts';
import { generateKeyPair } from '../encryption';

// Test configuration
interface TestConfig {
  enableLogging: boolean;
  timeoutMs: number;
  retryAttempts: number;
}

const DEFAULT_TEST_CONFIG: TestConfig = {
  enableLogging: true,
  timeoutMs: 10000,
  retryAttempts: 3
};

// Test result interface
interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: Error;
  details?: any;
}

interface TestSuite {
  name: string;
  results: TestResult[];
  passed: boolean;
  totalTests: number;
  passedTests: number;
  duration: number;
}

/**
 * Test Gun.js P2P connectivity
 */
export const testGunConnectivity = async (config: TestConfig = DEFAULT_TEST_CONFIG): Promise<TestResult> => {
  const startTime = Date.now();
  
  try {
    if (config.enableLogging) {
      console.log('Testing Gun.js connectivity...');
    }
    
    // Check basic connection status
    const connectionStatus = getConnectionStatus();
    
    if (!connectionStatus.isConnected && connectionStatus.connectedPeers === 0) {
      throw new Error('No Gun.js connections available');
    }
    
    // Test basic Gun operations
    const testKey = `test_connectivity_${Date.now()}`;
    const testData = { message: 'Hello Gun.js!', timestamp: new Date().toISOString() };
    
    // Write test data
    gun.get('test').get(testKey).put(testData);
    
    // Read test data back
    const readData = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Read timeout')), config.timeoutMs);
      
      gun.get('test').get(testKey).once((data: any) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });
    
    if (!readData || (readData as any).message !== testData.message) {
      throw new Error('Data read/write mismatch');
    }
    
    // Clean up test data
    gun.get('test').get(testKey).put(null);
    
    const duration = Date.now() - startTime;
    
    if (config.enableLogging) {
      console.log(`✅ Gun.js connectivity test passed (${duration}ms)`);
    }
    
    return {
      name: 'Gun.js Connectivity',
      passed: true,
      duration,
      details: { connectionStatus, testKey }
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (config.enableLogging) {
      console.error('❌ Gun.js connectivity test failed:', error);
    }
    
    return {
      name: 'Gun.js Connectivity',
      passed: false,
      duration,
      error: error as Error
    };
  }
};

/**
 * Test user authentication system
 */
export const testGunAuthentication = async (config: TestConfig = DEFAULT_TEST_CONFIG): Promise<TestResult> => {
  const startTime = Date.now();
  
  try {
    if (config.enableLogging) {
      console.log('Testing Gun.js authentication...');
    }
    
    // Generate test wallet
    const wallet = generateKeyPair();
    const testUsername = `test_user_${Date.now()}`;
    
    // Test user creation
    const createResult = await createGunUser(testUsername, wallet.privateKey, wallet.address);
    
    if (!createResult.address || createResult.address !== wallet.address) {
      throw new Error('User creation failed or address mismatch');
    }
    
    // Test authentication
    const authResult = await authenticateGunUser(wallet.address, wallet.privateKey);
    
    if (!authResult.address || authResult.address !== wallet.address) {
      throw new Error('Authentication failed or address mismatch');
    }
    
    const duration = Date.now() - startTime;
    
    if (config.enableLogging) {
      console.log(`✅ Gun.js authentication test passed (${duration}ms)`);
    }
    
    return {
      name: 'Gun.js Authentication',
      passed: true,
      duration,
      details: { username: testUsername, address: wallet.address }
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (config.enableLogging) {
      console.error('❌ Gun.js authentication test failed:', error);
    }
    
    return {
      name: 'Gun.js Authentication',
      passed: false,
      duration,
      error: error as Error
    };
  }
};

/**
 * Test messaging system
 */
export const testGunMessaging = async (config: TestConfig = DEFAULT_TEST_CONFIG): Promise<TestResult> => {
  const startTime = Date.now();
  
  try {
    if (config.enableLogging) {
      console.log('Testing Gun.js messaging...');
    }
    
    // Create two test users
    const wallet1 = generateKeyPair();
    const wallet2 = generateKeyPair();
    
    const user1 = await createGunUser(`sender_${Date.now()}`, wallet1.privateKey, wallet1.address);
    const user2 = await createGunUser(`recipient_${Date.now()}`, wallet2.privateKey, wallet2.address);
    
    // Create a thread between them
    const thread = await createGunThread(
      'Test Thread',
      [user1.address, user2.address],
      user1.address
    );
    
    if (!thread.id) {
      throw new Error('Thread creation failed');
    }
    
    // Send a test message
    const testMessage = 'Hello from Gun.js test!';
    const encryptedMessage = `[ENCRYPTED]${testMessage}`;  // Mock encryption for test
    
    const message = await sendGunMessage(
      thread.id,
      user1.address,
      wallet1.publicKey,
      wallet2.publicKey,
      encryptedMessage
    );
    
    if (!message.id || message.content !== encryptedMessage) {
      throw new Error('Message sending failed');
    }
    
    // Verify message was stored
    const storedMessage = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Message retrieval timeout')), config.timeoutMs);
      
      gun.get('message').get(message.id).once((data: any) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });
    
    if (!storedMessage || (storedMessage as any).content !== encryptedMessage) {
      throw new Error('Message retrieval failed');
    }
    
    const duration = Date.now() - startTime;
    
    if (config.enableLogging) {
      console.log(`✅ Gun.js messaging test passed (${duration}ms)`);
    }
    
    return {
      name: 'Gun.js Messaging',
      passed: true,
      duration,
      details: { 
        threadId: thread.id, 
        messageId: message.id,
        users: [user1.address, user2.address]
      }
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (config.enableLogging) {
      console.error('❌ Gun.js messaging test failed:', error);
    }
    
    return {
      name: 'Gun.js Messaging',
      passed: false,
      duration,
      error: error as Error
    };
  }
};

/**
 * Test contact management
 */
export const testGunContacts = async (config: TestConfig = DEFAULT_TEST_CONFIG): Promise<TestResult> => {
  const startTime = Date.now();
  
  try {
    if (config.enableLogging) {
      console.log('Testing Gun.js contacts...');
    }
    
    // Create test user
    const wallet = generateKeyPair();
    const user = await createGunUser(`contact_test_${Date.now()}`, wallet.privateKey, wallet.address);
    
    // Create test contact
    const contactWallet = generateKeyPair();
    const contactUsername = `test_contact_${Date.now()}`;
    
    const contact = await addGunContact(
      contactWallet.address,
      contactWallet.publicKey,
      contactUsername
    );
    
    if (!contact || contact.address !== contactWallet.address) {
      throw new Error('Contact creation failed');
    }
    
    // Verify contact was stored
    const storedContact = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Contact retrieval timeout')), config.timeoutMs);
      
      gun.user().get('contacts').get(contactWallet.address).once((data: any) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });
    
    if (!storedContact || (storedContact as any).username !== contactUsername) {
      throw new Error('Contact retrieval failed');
    }
    
    const duration = Date.now() - startTime;
    
    if (config.enableLogging) {
      console.log(`✅ Gun.js contacts test passed (${duration}ms)`);
    }
    
    return {
      name: 'Gun.js Contacts',
      passed: true,
      duration,
      details: { 
        userAddress: user.address,
        contactAddress: contact.address,
        contactUsername
      }
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (config.enableLogging) {
      console.error('❌ Gun.js contacts test failed:', error);
    }
    
    return {
      name: 'Gun.js Contacts',
      passed: false,
      duration,
      error: error as Error
    };
  }
};

/**
 * Test real-time synchronization between peers
 */
export const testGunRealtime = async (config: TestConfig = DEFAULT_TEST_CONFIG): Promise<TestResult> => {
  const startTime = Date.now();
  
  try {
    if (config.enableLogging) {
      console.log('Testing Gun.js real-time sync...');
    }
    
    const testKey = `realtime_test_${Date.now()}`;
    let receivedUpdate = false;
    
    // Set up listener
    gun.get('realtime_test').get(testKey).on((data: any) => {
      if (data && data.message === 'real-time update') {
        receivedUpdate = true;
      }
    });
    
    // Wait a moment for listener to be established
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Send update
    gun.get('realtime_test').get(testKey).put({
      message: 'real-time update',
      timestamp: new Date().toISOString()
    });
    
    // Wait for update to be received
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!receivedUpdate) {
          reject(new Error('Real-time update not received'));
        } else {
          resolve(true);
        }
      }, config.timeoutMs);
      
      const checkInterval = setInterval(() => {
        if (receivedUpdate) {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 100);
    });
    
    // Clean up
    gun.get('realtime_test').get(testKey).put(null);
    
    const duration = Date.now() - startTime;
    
    if (config.enableLogging) {
      console.log(`✅ Gun.js real-time test passed (${duration}ms)`);
    }
    
    return {
      name: 'Gun.js Real-time Sync',
      passed: true,
      duration,
      details: { testKey, receivedUpdate }
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (config.enableLogging) {
      console.error('❌ Gun.js real-time test failed:', error);
    }
    
    return {
      name: 'Gun.js Real-time Sync',
      passed: false,
      duration,
      error: error as Error
    };
  }
};

/**
 * Run complete Gun.js test suite
 */
export const runGunTestSuite = async (config: TestConfig = DEFAULT_TEST_CONFIG): Promise<TestSuite> => {
  const suiteStartTime = Date.now();
  
  if (config.enableLogging) {
    console.log('🚀 Starting Gun.js P2P test suite...');
  }
  
  const tests = [
    testGunConnectivity,
    testGunAuthentication,
    testGunMessaging,
    testGunContacts,
    testGunRealtime
  ];
  
  const results: TestResult[] = [];
  
  for (const test of tests) {
    try {
      const result = await test(config);
      results.push(result);
      
      if (config.enableLogging) {
        const status = result.passed ? '✅' : '❌';
        console.log(`${status} ${result.name}: ${result.passed ? 'PASSED' : 'FAILED'} (${result.duration}ms)`);
      }
      
      // Small delay between tests to prevent overwhelming Gun.js
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      results.push({
        name: test.name || 'Unknown Test',
        passed: false,
        duration: 0,
        error: error as Error
      });
    }
  }
  
  const suiteDuration = Date.now() - suiteStartTime;
  const passedTests = results.filter(r => r.passed).length;
  const allPassed = passedTests === results.length;
  
  const testSuite: TestSuite = {
    name: 'Gun.js P2P Test Suite',
    results,
    passed: allPassed,
    totalTests: results.length,
    passedTests,
    duration: suiteDuration
  };
  
  if (config.enableLogging) {
    console.log('\n📊 Test Suite Results:');
    console.log(`Total Tests: ${testSuite.totalTests}`);
    console.log(`Passed: ${testSuite.passedTests}`);
    console.log(`Failed: ${testSuite.totalTests - testSuite.passedTests}`);
    console.log(`Duration: ${testSuite.duration}ms`);
    console.log(`Status: ${allPassed ? '✅ ALL PASSED' : '❌ SOME FAILED'}`);
    
    if (!allPassed) {
      console.log('\n❌ Failed Tests:');
      results.filter(r => !r.passed).forEach(result => {
        console.log(`  - ${result.name}: ${result.error?.message || 'Unknown error'}`);
      });
    }
  }
  
  return testSuite;
};

/**
 * Test Gun.js performance with multiple operations
 */
export const testGunPerformance = async (config: TestConfig = DEFAULT_TEST_CONFIG): Promise<TestResult> => {
  const startTime = Date.now();
  
  try {
    if (config.enableLogging) {
      console.log('Testing Gun.js performance...');
    }
    
    const operationCount = 10;
    const testData = Array.from({ length: operationCount }, (_, i) => ({
      id: `perf_test_${i}_${Date.now()}`,
      message: `Performance test message ${i}`,
      timestamp: new Date().toISOString()
    }));
    
    // Test write performance
    const writeStartTime = Date.now();
    await Promise.all(
      testData.map(data => 
        new Promise<void>(resolve => {
          gun.get('performance_test').get(data.id).put(data);
          resolve();
        })
      )
    );
    const writeTime = Date.now() - writeStartTime;
    
    // Test read performance
    const readStartTime = Date.now();
    const readResults = await Promise.all(
      testData.map(data => 
        new Promise(resolve => {
          gun.get('performance_test').get(data.id).once(resolve);
        })
      )
    );
    const readTime = Date.now() - readStartTime;
    
    // Verify all data was read correctly
    const readSuccess = readResults.every(result => result && (result as any).message);
    
    if (!readSuccess) {
      throw new Error('Some performance test data was not read correctly');
    }
    
    // Clean up
    testData.forEach(data => {
      gun.get('performance_test').get(data.id).put(null);
    });
    
    const totalDuration = Date.now() - startTime;
    
    if (config.enableLogging) {
      console.log(`✅ Gun.js performance test passed (${totalDuration}ms)`);
      console.log(`  Write time: ${writeTime}ms (${operationCount} operations)`);
      console.log(`  Read time: ${readTime}ms (${operationCount} operations)`);
    }
    
    return {
      name: 'Gun.js Performance',
      passed: true,
      duration: totalDuration,
      details: {
        operationCount,
        writeTime,
        readTime,
        avgWriteTime: writeTime / operationCount,
        avgReadTime: readTime / operationCount
      }
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (config.enableLogging) {
      console.error('❌ Gun.js performance test failed:', error);
    }
    
    return {
      name: 'Gun.js Performance',
      passed: false,
      duration,
      error: error as Error
    };
  }
};