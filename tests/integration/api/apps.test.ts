import request from 'supertest';
import app from '../../../src/interfaces/http/app';

// This is a placeholder. A real test would require mocking the Docker Registry.
describe('GET /api/apps', () => {
  it('should return 200 OK', async () => {
    const res = await request(app).get('/api/apps');
    expect(res.statusCode).toEqual(200);
  });
});