import { v2 as cloudinary } from 'cloudinary';

const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
if (
  !cloudName ||
  !apiKey ||
  !apiSecret ||
  [cloudName, apiKey, apiSecret].some((value) => value.startsWith('REPLACE_'))
) {
  console.error('CLOUDINARY_CONFIG_INCOMPLETE');
  process.exitCode = 1;
} else {
  try {
    await cloudinary.api.ping({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      timeout: 20_000,
    });
    console.log('CLOUDINARY_AUTH_OK');
  } catch (error) {
    const status =
      typeof error?.http_code === 'number'
        ? error.http_code
        : 'NETWORK_OR_CONFIGURATION';
    console.error(`CLOUDINARY_AUTH_FAILED_${status}`);
    process.exitCode = 1;
  }
}
