/**
 * Footer - 与 lao Vue indexFooter 一致
 */
import { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { useI18n } from '../contexts/I18nContext';

const Footer: Component = () => {
  const { t } = useI18n();

  return (
    <footer class="footer">
      <div class="bit-center-wrap footer-box">
        <div class="flex flex-s-b pc-bottom pb-40">
          <div class="flex-h-c right-box2">
            <div class="flex-c bottom-item">
              <div class="title colorfs">
                <span>{t('footer.news')}</span>
              </div>
              <div class="flex-c right-box-text">
                <A href="/market" class="pointer">{t('footer.announcement')}</A>
                <span class="pointer">{t('footer.notice')}</span>
              </div>
            </div>
            <div class="flex-c bottom-item">
              <div class="title">
                <span>{t('footer.support')}</span>
              </div>
              <div class="flex-c right-box-text">
                <A href="/market" class="pointer">{t('footer.help')}</A>
                <span class="pointer">{t('footer.faq')}</span>
                <span class="pointer">{t('footer.contact')}</span>
              </div>
            </div>
            <div class="flex-c bottom-item">
              <div class="title">
                <span>{t('footer.download')}</span>
              </div>
              <div class="flex-c right-box-text">
                <span class="pointer">{t('footer.app')}</span>
                <span class="pointer">{t('footer.android')}</span>
                <span class="pointer">{t('footer.ios')}</span>
              </div>
            </div>
          </div>
          <div class="left-box flex-h-c">
            <div class="flex-v-c flex-h-c logo-box">
              <img src="/imgs/header_logo.png" alt="Logo" class="logo" onError={(e) => { (e.target as HTMLImageElement).src = '/assets/logo.png'; }} />
            </div>
          </div>
        </div>
        <div class="footer-copy">
          <div class="white ft20">{t('footer.siteName')}</div>
          <div class="fColor2 ft12">©Copyright 2021-2025. All rights reserved.</div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
