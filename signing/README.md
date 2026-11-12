# 운림사 Android 릴리스 서명 키

`unrimsa-release.p12.gpg`는 3.4 APK부터 사용한 PKCS#12 키 저장소의 AES-256 암호화 백업입니다. 별칭은 `unrimsa-release`입니다. 복호화와 PKCS#12 열기에는 별도로 보관된 동일한 암호를 사용합니다.

저장소 바깥의 작업 디렉터리에 키를 복원하려면 다음 명령을 실행하고, GPG가 요청하면 보관된 암호를 입력합니다.

```sh
gpg --output /path/to/unrimsa-release.p12 --decrypt signing/unrimsa-release.p12.gpg
```

릴리스 서명 인증서의 SHA-256 지문은 `8BF6FC89A7CB23CE414A24471B29D425221AC2BF80959AC0B153B74FCB26380`입니다.
