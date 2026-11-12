# 운림사 Android 릴리스 서명 키

`unrimsa-release.pk8`와 `unrimsa-release.x509.pem`은 운림사 3.4부터 사용한 서명 키와 인증서입니다. Android SDK Build Tools의 `apksigner`에서 암호 입력 없이 쓸 수 있습니다.

```sh
apksigner sign \
  --key signing/unrimsa-release.pk8 \
  --cert signing/unrimsa-release.x509.pem \
  --out unrimsa-android.apk unsigned.apk

apksigner verify --verbose --print-certs unrimsa-android.apk
```

이 키는 공개되어 있으므로 저장소를 읽을 수 있는 누구나 같은 인증서로 APK에 서명할 수 있습니다. 공식 APK는 이 저장소의 Releases에서 배포합니다.

인증서 SHA-256 지문은 `8BF6FC89A7CB23CE414A24471B29D425221AC2BF80959AC0B153B74FCB26380`입니다. `unrimsa-release.p12.gpg`는 기존 암호화 백업입니다.
