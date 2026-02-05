/**
 * 全站统一底部：FAQ 区块 + 四列 Footer
 * 在 RootLayout 中挂载，保证所有主站页面 UI 一致
 */
import { Component, createSignal } from 'solid-js';
import { A } from '@solidjs/router';
import { useI18n } from '../contexts/I18nContext';

const SITE_NAME = 'BTC Exchange';

export const FooterWithFaq: Component = () => {
  const { t } = useI18n();
  const [faqSelected, setFaqSelected] = createSignal<'legal' | 'deposit' | 'security'>('deposit');

  return (
    <>
      {/* 常見問題 FAQ - 平滑弹出进入，非固定焊死 */}
      <section
        class="faq-section bg-black py-12 md:py-14 px-4 reveal-section"
        ref={(el) => {
          if (!el) return;
          const io = new IntersectionObserver(
            ([e]) => {
              if (e?.isIntersecting) {
                el.classList.add('reveal-in');
                io.disconnect();
              }
            },
            { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
          );
          io.observe(el);
        }}
      >
        <div class="max-w-4xl mx-auto">
          <h2 class="faq-title text-center text-2xl md:text-3xl font-bold text-white mb-10">
            {t('faq.title')}<span class="text-[#4dd0e1]">({t('faq.titleFaq')})</span>
          </h2>
          <div class="faq-grid grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
            <div class="faq-column">
              <button type="button" class={`faq-row ${faqSelected() === 'legal' ? 'faq-row-active' : ''}`} onClick={() => setFaqSelected('legal')}>
                <span class="text-white">{t('faq.categoryLegal')}</span>
                <span class="faq-plus" aria-hidden="true">+</span>
              </button>
              <button type="button" class={`faq-row ${faqSelected() === 'deposit' ? 'faq-row-active' : ''}`} onClick={() => setFaqSelected('deposit')}>
                <span class="text-white">{t('faq.categoryDeposit')}</span>
                <span class="faq-plus" aria-hidden="true">+</span>
              </button>
              <button type="button" class={`faq-row ${faqSelected() === 'security' ? 'faq-row-active' : ''}`} onClick={() => setFaqSelected('security')}>
                <span class="text-white">{t('faq.categorySecurity')}</span>
                <span class="faq-plus" aria-hidden="true">+</span>
              </button>
            </div>
            <div class="faq-column">
              <button type="button" class="faq-row">
                <span class="text-white">{t('faq.q1')}</span>
                <span class="faq-plus" aria-hidden="true">+</span>
              </button>
              <button type="button" class="faq-row">
                <span class="text-white">{t('faq.q2')}</span>
                <span class="faq-plus" aria-hidden="true">+</span>
              </button>
              <button type="button" class="faq-row">
                <span class="text-white">{t('faq.q3')}</span>
                <span class="faq-plus" aria-hidden="true">+</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer 四列 */}
      <footer class="footer-new py-12 md:py-14 px-4">
        <div class="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-6">
          <div class="footer-col">
            <h3 class="footer-col-title text-white text-lg font-bold mb-4">{t('footer.aboutUs')}</h3>
            <ul class="space-y-2">
              <li><A href="/market" class="footer-link">{t('footer.announcementCenter')}</A></li>
              <li><A href="#" class="footer-link">{t('footer.termsOfService')}</A></li>
              <li><A href="#" class="footer-link">{t('footer.onlineService')}</A></li>
            </ul>
          </div>
          <div class="footer-col">
            <h3 class="footer-col-title text-white text-lg font-bold mb-4">{t('footer.productPlanning')}</h3>
            <ul class="space-y-2">
              <li><A href="#" class="footer-link">AI</A></li>
            </ul>
          </div>
          <div class="footer-col">
            <h3 class="footer-col-title text-white text-lg font-bold mb-4">{t('footer.assetManagement')}</h3>
            <ul class="space-y-2">
              <li><A href="/deposit" class="footer-link">{t('footer.quickDeposit')}</A></li>
              <li><A href="/withdraw" class="footer-link">{t('footer.withdrawal')}</A></li>
              <li><A href="/assets" class="footer-link">{t('footer.fundRecords')}</A></li>
            </ul>
          </div>
          <div class="footer-col">
            <h3 class="footer-col-title text-white text-lg font-bold mb-4">{t('footer.supportTitle')}</h3>
            <ul class="space-y-2">
              <li><A href="#" class="footer-link">{t('footer.aboutUs')}</A></li>
              <li><A href="#" class="footer-link">{t('footer.msb')}</A></li>
              <li><A href="#" class="footer-link">{t('footer.whitePaper')}</A></li>
              <li><A href="#" class="footer-link">{t('footer.scamWarning')}</A></li>
              <li><A href="#" class="footer-link">{t('footer.tradingRiskWarning')}</A></li>
              <li><A href="#" class="footer-link">{t('footer.privacyPolicy')}</A></li>
            </ul>
          </div>
        </div>
        <div class="max-w-6xl mx-auto mt-10 pt-6 border-t border-white/10 text-center text-white/60 text-sm">
          <p>© {new Date().getFullYear()} {SITE_NAME}. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
};

export default FooterWithFaq;
