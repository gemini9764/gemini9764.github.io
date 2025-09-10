---
title: GameplayTag와 GameplayCue
description: GameplayTag와 GameplayCue 아키텍처
author: gemini
date: 2025-09-10 19:00:00 +09:00
categories: [Unreal]
tags: [GameplayTag]
math: true
mermaid: true
---

#### GameplayTag의 본질

##### Bool 변수 지옥의 현실

- 전통적 방식의 문제점

```
class AMyCharacter
{
private:
    // 처음에는 간단해 보이지만...
    bool bIsBurning;
    bool bIsFrozen;
    bool bIsStunned;
    bool bIsSilenced;
    bool bIsPoisoned;
    bool bIsBlind;
    bool bIsSlowed;
    // ... 상태가 100개면 bool 100개?
};
```

1. 확장성 제로

```
void RemoveAllDebuffs()
{
    bIsBurning = false;
    bIsFrozen = false;
    bIsStunned = false;
    // 새로운 디버프 추가할 때마다 여기도 수정
}
```

2. 조건 검사의 복잡성

```
bool CanUseFireSpell()
{
    if (bIsFrozen) return false;
    if (bIsSilenced) return false;
    if (bIsStunned) return false;
    // 새로운 상태 추가할 때마다 여기도 수정
    return true;
}
```


##### Enum의 한계

```
enum class ECharacterState
{
    Normal,
    Burning,
    Frozen,
    Stunned,
    Poisoned
    // 하나의 상태만 가질 수 있음
};
```

*Enum은 단일 상태만 표현 가능하여 동시에 여러 상태를 가질 수 없다*


##### 태그 시스템의 핵심 개념

- GameplayTag는 **문자열 기반의 계층적 라벨 시스템**

```
Ability.Fire.Bolt         // 파이어볼트 능력
Status.Debuff.Frozen      // 얼음 디버프 상태
Cooldown.Ultimate         // 궁극기 쿨다운
GameplayCue.Explosion     // 폭발 연출 신호
```

```
Status                    // 최상위 (모든 상태의 부모)
├── Status.Buff          // 버프 (긍정적 효과)
├── Status.Debuff        // 디버프 (부정적 효과)
└── Status.Neutral       // 중립 (특수 상태)
```

- 핵심 특징
	1. **계층 구조** : 점으로 구분된 트리 형태
	2. **상속 검색** : 상위 태그로 하위 모든 태그 검색 가능
	3. **컨테이너 기반** : 여러 태그를 동시에 보유 가능

	```
	FGameplayTagContainer PlayerTags;  // 태그를 담는 컨테이너
	PlayerTags.AddTag("Status.Buff.Haste");       // 가속 버프
	PlayerTags.AddTag("Status.Debuff.Poisoned");  // 중독 디버프
	PlayerTags.AddTag("Cooldown.FireBolt");       // 파이어볼트 쿨다운
	```

	4. **에디터 통합** : 자동완성, 검증, 관리 도구 제공


##### 계층 구조 - 실제 예시로 이해하기

```
Status
├── Status.Buff
│   ├── Status.Buff.Temporary.Haste
│   └── Status.Buff.Permanent.Blessing
└── Status.Debuff
    ├── Status.Debuff.MovementImpaired
    │   ├── Status.Debuff.MovementImpaired.Slow
    │   └── Status.Debuff.MovementImpaired.Stun
    └── Status.Debuff.DamageOverTime
        ├── Status.Debuff.DamageOverTime.Poison
        └── Status.Debuff.DamageOverTime.Burning
```

- 가능한 검색들

```
// 모든 디버프 체크
if (ASC->HasMatchingGameplayTag("Status.Debuff"))
{
    // 새로운 디버프가 추가되어도 코드 수정 불필요
}

// 이동 방해 디버프만 체크
if (ASC->HasMatchingGameplayTag("Status.Debuff.MovementImpaired"))
{
    // 감속, 속박, 스턴 중 하나라도 있으면 실행
}

// 정확히 스턴만 체크
if (ASC->HasMatchingGameplayTag("Status.Debuff.MovementImpaired.Stun"))
{
    // 오직 스턴 상태일 때만
}
```

```
// 기존 방식 - 하드코딩 지옥
bool HasAnyDebuff()
{
    return bIsBurning || bIsFrozen || bIsStunned || bIsPoisoned ||
           bIsSlowed || bIsRooted || bIsSilenced || bIsBlind ||
           bIsWeakened || bIsCursed || bIsHexed || /* ... */;
    // 디버프 100개면 100개 다 나열
    // 새로운 디버프 추가할 때마다 수정
    // 하나라도 빼먹으면 버그 ㅅㄱ
}
```


##### 태그 매칭의 종류 - 세밀한 제어

1. Exact Match (정확 일치)

```
HasMatchingGameplayTag("Status.Debuff.Frozen")
```

2. Partial Match (부분 일치)

```
HasMatchingGameplayTag("Status.Debuff")
// Status.Debuff로 시작하는 모든 태그 매치
```

3. Container Match (컨테이너 일치)

```
FGameplayTagContainer RequiredTags;
RequiredTags.AddTag("Status.Buff.Haste");
RequiredTags.AddTag("Status.Buff.Shield");

if (ASC->HasAnyMatchingGameplayTags(RequiredTags))
{
    // 하나라도 있으면
}

if (ASC->HasAllMatchingGameplayTags(RequiredTags))
{
    // 모두 있어야 함
}
```


##### 태그 저장과 검색 매커니즘

- 내부 구조

```
struct FGameplayTag
{
    FName TagName;  // 해시 기반 빠른 비교
};

struct FGameplayTagContainer
{
    TArray<FGameplayTag> GameplayTags;
    TArray<FGameplayTag> ParentTags;  // 미리 계산된 부모 태그들
};

ParentTags.Add("Status");
ParentTags.Add("Status.Debuff");
ParentTags.Add("Status.Debuff.Frozen");
```

- 최적화 포인트
	- FName 기반 O(1) 비교 속도
	- 부모 태그 미리 계산하여 캐시
	- 네트워크에서 인덱스로 전송


##### 태그와 Ability System의 통합

```
class UMyAbility : public UGameplayAbility
{
    // 이 Ability가 가진 태그들
    FGameplayTagContainer AbilityTags;

    // 이 태그들이 있으면 실행 불가
    FGameplayTagContainer BlockAbilitiesWithTag;

    // 이 태그들이 모두 있어야 실행 가능
    FGameplayTagContainer ActivationRequiredTags;

    // 실행 중에 추가되는 태그들
    FGameplayTagContainer ActivationOwnedTags;
};
```

- 파이어볼트 스킬 설정 예시

```
UFireBoltAbility::UFireBoltAbility()
{
    AbilityTags.AddTag("Ability.Fire.Bolt");
    AbilityTags.AddTag("Ability.Offensive");

    BlockAbilitiesWithTag.AddTag("Status.Debuff.Silenced");
    BlockAbilitiesWithTag.AddTag("Status.Debuff.Frozen");

    ActivationOwnedTags.AddTag("Status.Casting");
    ActivationOwnedTags.AddTag("Cooldown.FireBolt");
}
```


##### 명명 규칙과 체계화 - 팀 작업의 핵심

- 추천구조

```
Ability
├── Ability.Active.Fire.Bolt
├── Ability.Passive.FireResist
└── Ability.Ultimate.Meteor

Status
├── Status.Buff.Temporary
├── Status.Debuff.MovementImpaired
└── Status.Neutral.InCombat

Cooldown
├── Cooldown.Ability.Fire
└── Cooldown.Item.Potion

GameplayCue
├── GameplayCue.Impact
├── GameplayCue.Status
└── GameplayCue.Environment

Damage
├── Damage.Physical.Slash
├── Damage.Magical.Fire
└── Damage.True.Percentage
```

- 명명 규칙 가이드라인
	1. 상위 -> 하위로 갈수록 구체적으로
	2. 동일 계층은 동일한 패턴
	3. 미래 추가 요소 고려한 구조
	4. 영어 단수형, PascalCase 사용


##### 태그 관리 전략 - 프로젝트 관리 관점

- 중앙 집중식 관리

```
; Config/DefaultGameplayTags.ini
[/Script/GameplayTags.GameplayTagsSettings]

+GameplayTagList=(Tag="Status.Burning",DevComment="불타는 상태 - 지속 피해")
+GameplayTagList=(Tag="Status.Frozen",DevComment="얼어붙은 상태 - 이동/행동 불가")
+GameplayTagList=(Tag="Ability.Fire.Bolt",DevComment="파이어볼트 - 기본 화염 스킬")
```

- 버전 관리와 호환성

```
+GameplayTagRedirects=(OldTagName="OldStatus.Burn",NewTagName="Status.Debuff.Burning")
```


#### GameplayCue의 본질과 생명주기

##### 전통적 연출 시스템의 한계

- 전통적 방식
