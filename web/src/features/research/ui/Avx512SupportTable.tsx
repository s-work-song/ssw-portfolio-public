/**
 * AVX-512 하위 집합을 제품군별로 점으로 보여 주는 표다.
 * 나중 제품이 앞 제품의 조합을 다 포함하지 않는 경우가 행마다 보이도록 행렬로 그린다.
 * 겹치는 모양은 원작자의 오일러 다이어그램에 링크만 건다. 그 저장소에 라이선스가 없어 그림을 옮겨 오지 않는다.
 * 좁은 화면에서는 표 안에서만 가로로 스크롤한다.
 */
import { avx512Products, avx512SubsetGroups } from '@/features/research/data/avx512Support';
import styles from './Avx512SupportTable.module.css';

const INSTLATX64_EULER_URL =
  'https://github.com/InstLatx64/InstLatX64_Misc/blob/main/SIMD_Euler/20260629_x64_AVX512_Euler_v341a_HR.png';

export default function Avx512SupportTable() {
  return (
    <figure className={styles.figure}>
      <div className={styles.scroller} tabIndex={0} role="region" aria-label="제품군별 AVX-512 하위 집합 지원 표">
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" className={styles.productHeader}>제품군</th>
              {avx512SubsetGroups.map((group) => (
                <th key={group.id} scope="col" className={styles.subsetHeader} title={group.members.join(', ')}>
                  {/* 이름 중간이 아니라 가운뎃점 뒤에서만 줄을 바꾼다. */}
                  {group.label.split('·').map((part, index) => (
                    <span key={part}>{index > 0 && <>·<wbr /></>}{part}</span>
                  ))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {avx512Products.map((product) => (
              <tr key={product.name}>
                <th scope="row" className={styles.product}>
                  <span className={styles.productName}>{product.name}</span>
                  <span className={styles.productDetail}>{product.detail}</span>
                </th>
                {product.note ? (
                  <td colSpan={avx512SubsetGroups.length} className={styles.note}>{product.note}</td>
                ) : (
                  avx512SubsetGroups.map((group) => (
                    <td key={group.id} className={styles.cell}>
                      {product.supported.includes(group.id) ? (
                        <span className={styles.dot} role="img" aria-label="지원" />
                      ) : (
                        <span className={styles.srOnly}>미지원</span>
                      )}
                    </td>
                  ))
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className={styles.caption}>
        점은 지원, 빈칸은 미지원입니다. &ldquo;VBMI2 외 4종&rdquo;은 VBMI2·BITALG·GFNI·VAES·VPCLMULQDQ입니다. 이 표의 제품에서는 다섯 가지의 지원 여부가 늘 같아 한 열로 묶었습니다.
        데이터는 Wikipedia AVX-512 문서와 제품 발표 기사를 기준으로 했습니다. 하위 집합이 겹치는 모양은 InstLatX64가 그린{' '}
        <a href={INSTLATX64_EULER_URL} target="_blank" rel="noreferrer" className={styles.link}>AVX-512 오일러 다이어그램(2026년 6월판)</a>에서
        한눈에 볼 수 있고, 이 표도 그 그림에서 착안했습니다.
      </figcaption>
    </figure>
  );
}
