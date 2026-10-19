// กฎทิศทางของ DDD สำหรับ ESLint flat config
// ใช้: ใน eslint.config.js ให้เพิ่ม  import boundaries from './eslint.boundaries.js'
//      แล้ว export default [ ...ของเดิม, ...boundaries ]

// import ไฟล์ข้างในของ context อื่น (เช่น ../../catalog/domain/book) ห้ามทุกชั้น
const crossContext = {
  // ใช้ regex แทน glob เพราะ * ใน glob จับ '..' ได้ ทำให้เทสต์ใน __tests__ ที่ import ชั้นอื่นของ context ตัวเองโดนด้วย
  regex: '^(\\.\\./){2,3}(?!\\.\\./)[^/]+/(domain|application|infrastructure|interface)(/|$)',
  message: 'ห้าม import ไฟล์ข้างในของ context อื่น ให้ใช้ modules/<context>/index.ts หรือประกาศใน application/ports.ts',
};

const rule = (patterns) => ({
  'no-restricted-imports': ['error', { patterns: [...patterns, crossContext] }],
});

export default [
  {
    files: ['src/modules/*/domain/**/*.ts'],
    rules: rule([{
      group: ['pg', 'express', 'typeorm', 'prisma', '@prisma/*', 'knex',
              '**/application/**', '**/infrastructure/**', '**/interface/**'],
      message: 'domain ห้าม import ชั้นอื่นหรือไลบรารี DB/HTTP',
    }]),
  },
  {
    files: ['src/modules/*/application/**/*.ts'],
    rules: rule([{
      group: ['pg', 'express', 'typeorm', 'prisma', '@prisma/*', 'knex',
              '**/infrastructure/**', '**/interface/**'],
      message: 'application ห้ามรู้จัก DB, HTTP หรือ infrastructure ให้ประกาศ interface แล้วรับเข้ามาทาง constructor',
    }]),
  },
  {
    files: ['src/modules/*/infrastructure/**/*.ts'],
    rules: rule([{ group: ['express', '**/interface/**'], message: 'infrastructure ห้ามรู้จัก HTTP' }]),
  },
  {
    files: ['src/modules/*/interface/**/*.ts'],
    rules: rule([{ group: ['pg', 'typeorm', 'prisma', '@prisma/*', 'knex', '**/infrastructure/**'],
                   message: 'interface ห้ามเขียน SQL หรือเรียก infrastructure ตรง ให้เรียกผ่าน use case' }]),
  },
];
