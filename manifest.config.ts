import {defineManifest} from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'Immersion Kit Mining Helper',
  version: '0.1.0',
  description: 'Send Immersion Kit example sentence media to the latest Anki note.',
  permissions: ['storage'],
  host_permissions: [
    'https://www.immersionkit.com/*',
    'https://immersionkit.com/*',
    'https://apiv2.immersionkit.com/*',
    'https://us-southeast-1.linodeobjects.com/*',
    'http://127.0.0.1/*'
  ],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module'
  },
  content_scripts: [
    {
      matches: [
        'https://www.immersionkit.com/dictionary*',
        'https://immersionkit.com/dictionary*'
      ],
      js: ['src/content/index.ts'],
      run_at: 'document_idle'
    }
  ],
  options_page: 'src/options/index.html'
});
