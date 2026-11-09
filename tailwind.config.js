/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        rounded: ['"Zen Maru Gothic"', '"Quicksand"', '"Noto Sans TC"', '"PingFang TC"', '"Microsoft JhengHei"', 'sans-serif'],
      },
      colors: {
        canvas: '#ECE8DF',
        stage: '#DEDCD3',
        card: '#FAF8F3',
        card2: '#EFECE4',
        line: '#DDD7C9',
        ink: '#2D251E',
        cocoa: '#5C5044',
        oatgray: '#8A7E70',
        butter: '#F2CA62',
        caramel: '#C48E63',
        navy: '#1E3158',
        cupred: '#C83D33',
      },
      boxShadow: {
        card: '0 8px 24px -6px rgba(60, 48, 36, 0.07)',
        pop: '0 14px 36px -10px rgba(60, 48, 36, 0.22)',
      },
    },
  },
  plugins: [],
};
