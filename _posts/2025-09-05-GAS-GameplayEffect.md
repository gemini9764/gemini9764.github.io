---
title: GameplayEffect
description: GameplayEffect와 Execution
author: gemini
date: 2025-09-05 19:00:00 +09:00
categories: [Unreal]
tags: [GAS]
math: true
mermaid: true
---

#### GameplayEffect의 본질

- GameplayEffect = 마법사의 주문과 동일한 개념
	- 번개 마법 : 라이트닝 볼트 -> 즉시 적 타격 -> 끝
	- 독 마법 : 포이즌 클라우드 -> 10초간 지속 데미지 -> 자동 해제
	- 축복 마법 : 디바인 블레싱 -> 영구적으로 힘 증가 -> 해제 주문 필요
- 3가지 Effect 타입

|타입|지속시간|적용 방식|용도|
|---|---|---|---|
|**Instant**|없음|한번 실행, 즉시 소멸|데미지, 힐링, 즉시 버프|
|**Duration**|설정값 (ex: 10초)|주기적/지속 효과|독/화상, 쿨다운, 임시 버프|
|**Infinite**|무한|영구 적용, 수동 제거까지|장비 효과, 패시브 스킬|
- 실제 게임 시나리오 (전사 캐릭터)
	- 몬스터 공격 (Instant)
		- 검 휘두르기 -> 즉시 몬스터 HP -50 -> 끝
	- 체력 물약 사용 (Instant)
		- 빨간 물약 마시기 -> 즉시 HP +100 -> 끝
	- 독 늪 진입 (Duration)
		- 독 늪 접촉 -> 10초간 매초 HP -5 -> 자동 해제
	- 방어막 마법 (Duration)
		- 마법사 버프 -> 30초간 방어력 +20 -> 자동 소멸
	- 액스칼리버 장착 (Infinite)
		- 전설 무기 착용 -> 공격력 +100 (영구) -> 무기 해제까지 유지


#### Modifier 연산의 3단계

- 계산 순서 : Add -> Multiply -> Override
- 예시 : 기본 체력 100인 캐릭터

```
BaseValue: 100

1️ ADD 단계
장비 보너스: +30
근력 훈련: +20
독 디버프: -10
→ 결과: 100 + 30 + 20 - 10 = 140

2️ MULTIPLY 단계
거인화 물약: ×1.5
약화 저주: ×0.8
→ 결과: 140 × 1.5 × 0.8 = 168

3️ OVERRIDE 단계
신의 축복: = 999
→ 최종 결과: 999
```

##### 각 단계별 특징

- Add (더하기 / 빼기)

	```
	Modifier.ModifierOp = EGameplayModOp::Additive;
	Modifier.ModifierMagnitude.SetValue(30.0f);  // +30
	```
	
	- 장비 효과, 소모품, 기본 버프 / 디버프
	- 가장 직관적이고 예측 가능
	- 여러 개 적용 시 단순 누적

- Multiply (곱하기)

	```
	Modifier.ModifierOp = EGameplayModOp::Multiplicative;
	Modifier.ModifierMagnitude.SetValue(1.5f);  // 150% (50% 증가)
	```
	- 백분율 버프, 클래스 배율, 레벨 스케일링
	- Add 결과에 곱셈 적용
	- 여러 개 적용 시 연쇄 곱셈

- Override (덮어쓰기)

	```
	Modifier.ModifierOp = EGameplayModOp::Override;
	Modifier.ModifierMagnitude.SetValue(999.0f);  // 강제로 999
	```
	- 무적 상태, 즉사 공격, 치트 모드
	- 모든 계산 무시하고 강제 설정
	- 가장 강력하고 위험한 연산


#### Cost & Cooldown 시스템

- 전통적인 방식의 문제점

	```
	// 전통적인 방식 - 개발자가 직접 다 관리 ㅋ
	class AMyCharacter
	{
	    float Mana = 100.0f;
	    float LastSkillTime = 0.0f;
    
	    void UseSkill()
	    {
	        float CurrentTime = GetWorld()->GetTimeSeconds();
        
	        // 쿨다운 체크
	        if (CurrentTime - LastSkillTime < 3.0f) 
	        {
	            // 아직 3초 안 지났으면 실행 안 함
	            return;
	        }
        
	        // 마나 체크  
	        if (Mana < 30.0f) 
	        {
	            // 마나 부족하면 실행 안 함
	            return;
	        }
        
	        // 모든 체크 통과하면 실행
	        Mana -= 30.0f;
	        LastSkillTime = CurrentTime;
	        DoSkill();
	    }
	};
	```

	- 스킬마다 중복 코드 작성
	- 네트워크 동기화 복잡
	- 버프/디버프 적용 어려움
	- UI 업데이트 별도 구현

- GAS의 해결법
	- 두 개의 GameplayEffect로 모든 것 해결

```
GAS Cost & Cooldown 시스템

스킬 사용 요청
    ↓
ASC 자동 체크:
"Cost 감당 가능?"
"Cooldown 끝남?"
    ↓
조건 만족 시:
1. Cost Effect 적용 (자원 차감)
2. Cooldown Effect 적용 (시간 차단)
3. 실제 스킬 실행
```

- Cost Effect 구현

```
// CostEffect_Dash.cpp
UCostEffect_Dash::UCostEffect_Dash()
{
    // Instant: 한 번만 적용하고 사라짐
    DurationPolicy = EGameplayEffectDurationType::Instant;

    // 마나 30 차감
    FGameplayModifierInfo ModifierInfo;
    ModifierInfo.ModifierMagnitude.SetValue(-30.0f);  // 음수 = 차감
    ModifierInfo.ModifierOp = EGameplayModOp::Additive;
    ModifierInfo.Attribute = UMyAttributeSet::GetManaAttribute();

    Modifiers.Add(ModifierInfo);
}
```

```
// CostEffect_Dash.cpp
UCostEffect_Dash::UCostEffect_Dash()
{
    // Instant: 한 번만 적용하고 사라짐
    DurationPolicy = EGameplayEffectDurationType::Instant;

    // 마나 30 차감
    FGameplayModifierInfo ModifierInfo;
    ModifierInfo.ModifierMagnitude.SetValue(-30.0f);  // 음수 = 차감
    ModifierInfo.ModifierOp = EGameplayModOp::Additive;
    ModifierInfo.Attribute = UMyAttributeSet::GetManaAttribute();

    Modifiers.Add(ModifierInfo);
}
```

- Cooldown Effect 구현

```
// CooldownEffect_Dash.cpp
UCooldownEffect_Dash::UCooldownEffect_Dash()
{
    // Duration: 3초간 지속
    DurationPolicy = EGameplayEffectDurationType::HasDuration;
    DurationMagnitude.SetValue(3.0f);

    // 쿨다운 태그 설정
    InheritableOwnedGameplayTags.AddTag(
        FGameplayTag::RequestGameplayTag("Cooldown.Dash")
    );
}
```

```
// DashAbility.cpp 생성자
UDashAbility::UDashAbility()
{
    // Cooldown 태그와 Effect 지정
    CooldownTags.AddTag(FGameplayTag::RequestGameplayTag("Cooldown.Dash"));
    CooldownGameplayEffectClass = UCooldownEffect_Dash::StaticClass();
}
```


#### 힐링 스킬 구현 코드

- 스킬설계
	- Divine Heal (신성한 치유)
		- 효과 : 즉시 체력 +80 회복
		- Cost : 마나 40 소모
		- Cooldown : 5초
		- 키 : H키

1. HealEffect (체력 회복)

***HealEffect.h***

```
#pragma once

#include "CoreMinimal.h"
#include "GameplayEffect.h"
#include "HealEffect.generated.h"

UCLASS()
class GASDEMO_API UHealEffect : public UGameplayEffect
{
    GENERATED_BODY()

public:
    UHealEffect();
};
```

***HealEffect.cpp***

```
#include "HealEffect.h"
#include "MyAttributeSet.h"

UHealEffect::UHealEffect()
{
    // Instant Effect: 즉시 적용 후 사라짐
    DurationPolicy = EGameplayEffectDurationType::Instant;

    // Health Modifier 설정
    FGameplayModifierInfo HealthModifier;
    HealthModifier.ModifierMagnitude.SetValue(80.0f);  // +80 체력
    HealthModifier.ModifierOp = EGameplayModOp::Additive;  // 더하기
    HealthModifier.Attribute = UMyAttributeSet::GetHealthAttribute();

    // Effect에 Modifier 추가
    Modifiers.Add(HealthModifier);
}
```


2. HealCostEffect (마나 소모)

***HealCostEffect.h***

```
#pragma once

#include "CoreMinimal.h"
#include "GameplayEffect.h"
#include "HealCostEffect.generated.h"

UCLASS()
class GASDEMO_API UHealCostEffect : public UGameplayEffect
{
    GENERATED_BODY()

public:
    UHealCostEffect();
};
```

***HealCostEffect.cpp***

```
#include "HealCostEffect.h"
#include "MyAttributeSet.h"

UHealCostEffect::UHealCostEffect()
{
    // Instant Effect: 즉시 마나 차감
    DurationPolicy = EGameplayEffectDurationType::Instant;

    // Mana Modifier 설정
    FGameplayModifierInfo ManaModifier;
    ManaModifier.ModifierMagnitude.SetValue(-40.0f);  // -40 마나
    ManaModifier.ModifierOp = EGameplayModOp::Additive;  // 더하기(실제로는 빼기)
    ManaModifier.Attribute = UMyAttributeSet::GetManaAttribute();

    // Effect에 Modifier 추가
    Modifiers.Add(ManaModifier);
}
```


3. HealCooldownEffect (쿨다운)

***HealCooldownEffect.h***

```
#pragma once

#include "CoreMinimal.h"
#include "GameplayEffect.h"
#include "GameplayTagContainer.h"
#include "HealCooldownEffect.generated.h"

UCLASS()
class GASDEMO_API UHealCooldownEffect : public UGameplayEffect
{
    GENERATED_BODY()

public:
    UHealCooldownEffect();
};
```

***HealCooldownEffect.cpp***

```
#include "HealCooldownEffect.h"

UHealCooldownEffect::UHealCooldownEffect()
{
    // Duration Effect: 5초간 지속
    DurationPolicy = EGameplayEffectDurationType::HasDuration;
    DurationMagnitude.SetValue(5.0f);

    // 쿨다운 태그 설정 - 이 태그가 있는 동안은 힐링 스킬 사용 불가
    InheritableOwnedGameplayTags.AddTag(
        FGameplayTag::RequestGameplayTag("Cooldown.Heal")
    );
}
```


4. HealAbility (힐링 스킬)

***HealAbility.h***

```
#pragma once

#include "CoreMinimal.h"
#include "Abilities/GameplayAbility.h"
#include "HealAbility.generated.h"

UCLASS()
class GASDEMO_API UHealAbility : public UGameplayAbility
{
    GENERATED_BODY()

public:
    UHealAbility();

protected:
    // 실제 힐링 Effect
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Heal")
    TSubclassOf<class UGameplayEffect> HealEffectClass;

    // 힐링 애니메이션/이펙트
    virtual void ActivateAbility(
        const FGameplayAbilitySpecHandle Handle,
        const FGameplayAbilityActorInfo* ActorInfo,
        const FGameplayAbilityActivationInfo ActivationInfo,
        const FGameplayEventData* TriggerEventData
    ) override;

    virtual void EndAbility(
        const FGameplayAbilitySpecHandle Handle,
        const FGameplayAbilityActorInfo* ActorInfo,
        const FGameplayAbilityActivationInfo ActivationInfo,
        bool bReplicateEndAbility,
        bool bWasCancelled
    ) override;
};
```

***HealAbility.cpp***

```
#include "HealAbility.h"
#include "HealEffect.h"
#include "HealCostEffect.h"
#include "HealCooldownEffect.h"
#include "AbilitySystemComponent.h"

UHealAbility::UHealAbility()
{
    // 인스턴싱 설정
    InstancingPolicy = EGameplayAbilityInstancingPolicy::InstancedPerActor;

    // Cost와 Cooldown Effect 연결
    CostGameplayEffectClass = UHealCostEffect::StaticClass();
    CooldownGameplayEffectClass = UHealCooldownEffect::StaticClass();

    // Cooldown 태그 설정 (이 태그가 있으면 스킬 사용 불가)
    CooldownTags.AddTag(FGameplayTag::RequestGameplayTag("Cooldown.Heal"));

    // 실제 힐링 Effect 설정
    HealEffectClass = UHealEffect::StaticClass();
}

void UHealAbility::ActivateAbility(
    const FGameplayAbilitySpecHandle Handle,
    const FGameplayAbilityActorInfo* ActorInfo,
    const FGameplayAbilityActivationInfo ActivationInfo,
    const FGameplayEventData* TriggerEventData)
{
    // Cost/Cooldown 검증 및 적용
    if (!CommitAbility(Handle, ActorInfo, ActivationInfo))
    {
        UE_LOG(LogTemp, Warning, TEXT("Heal failed: Cost or Cooldown check failed"));
        EndAbility(Handle, ActorInfo, ActivationInfo, true, false);
        return;
    }

    // 실제 힐링 Effect 적용
    if (HealEffectClass && ActorInfo->AbilitySystemComponent.IsValid())
    {
        FGameplayEffectContextHandle ContextHandle =
            ActorInfo->AbilitySystemComponent->MakeEffectContext();
        ContextHandle.AddSourceObject(this);

        FGameplayEffectSpecHandle SpecHandle =
            ActorInfo->AbilitySystemComponent->MakeOutgoingSpec(
                HealEffectClass, 1, ContextHandle);

        if (SpecHandle.IsValid())
        {
            ActorInfo->AbilitySystemComponent->ApplyGameplayEffectSpecToSelf(
                *SpecHandle.Data.Get());

            UE_LOG(LogTemp, Log, TEXT("Divine Heal activated! +80 HP"));
        }
    }

    // 스킬 종료
    EndAbility(Handle, ActorInfo, ActivationInfo, true, false);
}

void UHealAbility::EndAbility(
    const FGameplayAbilitySpecHandle Handle,
    const FGameplayAbilityActorInfo* ActorInfo,
    const FGameplayAbilityActivationInfo ActivationInfo,
    bool bReplicateEndAbility,
    bool bWasCancelled)
{
    UE_LOG(LogTemp, Log, TEXT("Heal ability ended"));
    Super::EndAbility(Handle, ActorInfo, ActivationInfo, bReplicateEndAbility, bWasCancelled);
}
```


5. 캐릭터에 연결

***GASCharacter.h***에 추가

```
// 힐링 스킬
UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "GAS")
TSubclassOf<UGameplayAbility> HealAbilityClass;
```

***GASCharacter.cpp***에 추가

```
// 생성자에서 힐링 스킬 설정
AGASCharacter::AGASCharacter()
{
    // ... 기존 코드 ...

    // 힐링 스킬 클래스 지정
    HealAbilityClass = UHealAbility::StaticClass();
}

// 입력 처리에 H키 추가
void AGASCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    // ... 기존 코드 ...

    // H키로 힐링 스킬 발동
    PlayerInputComponent->BindAction("Heal", IE_Pressed, this, &AGASCharacter::InputHeal);
}

// 힐링 입력 처리 함수
void AGASCharacter::InputHeal()
{
    if (AbilitySystemComponent && HealAbilityClass)
    {
        bool bSuccess = AbilitySystemComponent->TryActivateAbilityByClass(HealAbilityClass);
        if (bSuccess)
        {
            UE_LOG(LogTemp, Log, TEXT("Heal ability activated"));
        }
        else
        {
            UE_LOG(LogTemp, Warning, TEXT("Heal ability failed (cooldown or insufficient mana)"));
        }
    }
}
```

- 테스트 시나리오

|단계|상황|체력|마나|결과|
|---|---|---|---|---|
|초기|게임 시작|100/100|50/50|-|
|1|데미지 입음|70/100|50/50|-|
|2|H키 (힐링)|100/100|10/50|성공, 5초 쿨다운|
|3|H키 연타|100/100|10/50|실패 (쿨다운)|
|4|5초 후 H키|100/100|10/50|실패 (마나 부족)|


#### 버프 시스템 구현 코드

- 스킬 설계
	- Strength Potion (힘의 물약)
		- 효과  : 60초간 공격력 +50
		- Cost : 마나 20 소모
		- Cooldown : 없음 (중첩 가능)
		- 키 : B키

1. StrengthBuffEffect (지속 버프)

***StrengthBuffEffect.h***

```
#pragma once

#include "CoreMinimal.h"
#include "GameplayEffect.h"
#include "StrengthBuffEffect.generated.h"

UCLASS()
class GASDEMO_API UStrengthBuffEffect : public UGameplayEffect
{
    GENERATED_BODY()

public:
    UStrengthBuffEffect();
};

```

***StrengthBuffEffect.cpp***

```
#include "StrengthBuffEffect.h"
#include "MyAttributeSet.h"

UStrengthBuffEffect::UStrengthBuffEffect()
{
    // Duration Effect: 60초간 지속
    DurationPolicy = EGameplayEffectDurationType::HasDuration;
    DurationMagnitude.SetValue(60.0f);

    // 공격력 Modifier 설정
    FGameplayModifierInfo AttackModifier;
    AttackModifier.ModifierMagnitude.SetValue(50.0f);  // +50 공격력
    AttackModifier.ModifierOp = EGameplayModOp::Additive;  // 더하기
    AttackModifier.Attribute = UMyAttributeSet::GetAttackPowerAttribute();

    // Effect에 Modifier 추가
    Modifiers.Add(AttackModifier);

    // 버프 태그 설정 (UI 표시용)
    InheritableOwnedGameplayTags.AddTag(
        FGameplayTag::RequestGameplayTag("Buff.Strength")
    );

    // 중첩 설정: 같은 버프를 여러 번 받을 수 있도록
    StackingType = EGameplayEffectStackingType::AggregateByTarget;
    StackLimitCount = 5;  // 최대 5스택
    StackDurationRefreshPolicy = EGameplayEffectStackingDurationPolicy::RefreshOnSuccessfulApplication;
    StackPeriodResetPolicy = EGameplayEffectStackingPeriodResetPolicy::ResetOnSuccessfulApplication;
}

```


2. BuffCostEffect (마나 소모)

***BuffCostEffect.h***

```
#pragma once

#include "CoreMinimal.h"
#include "GameplayEffect.h"
#include "BuffCostEffect.generated.h"

UCLASS()
class GASDEMO_API UBuffCostEffect : public UGameplayEffect
{
    GENERATED_BODY()

public:
    UBuffCostEffect();
};

```

***BuffCostEffect.cpp***

```
#include "BuffCostEffect.h"
#include "MyAttributeSet.h"

UBuffCostEffect::UBuffCostEffect()
{
    // Instant Effect: 즉시 마나 차감
    DurationPolicy = EGameplayEffectDurationType::Instant;

    // Mana Modifier 설정
    FGameplayModifierInfo ManaModifier;
    ManaModifier.ModifierMagnitude.SetValue(-20.0f);  // -20 마나
    ManaModifier.ModifierOp = EGameplayModOp::Additive;  // 더하기(실제로는 빼기)
    ManaModifier.Attribute = UMyAttributeSet::GetManaAttribute();

    // Effect에 Modifier 추가
    Modifiers.Add(ManaModifier);
}
```


3. BuffAbility (버프 스킬)

***BuffAbility.h***

```
#pragma once

#include "CoreMinimal.h"
#include "Abilities/GameplayAbility.h"
#include "BuffAbility.generated.h"

UCLASS()
class GASDEMO_API UBuffAbility : public UGameplayAbility
{
    GENERATED_BODY()

public:
    UBuffAbility();

protected:
    // 버프 Effect
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Buff")
    TSubclassOf<class UGameplayEffect> BuffEffectClass;

    virtual void ActivateAbility(
        const FGameplayAbilitySpecHandle Handle,
        const FGameplayAbilityActorInfo* ActorInfo,
        const FGameplayAbilityActivationInfo ActivationInfo,
        const FGameplayEventData* TriggerEventData
    ) override;

    virtual void EndAbility(
        const FGameplayAbilitySpecHandle Handle,
        const FGameplayAbilityActorInfo* ActorInfo,
        const FGameplayAbilityActivationInfo ActivationInfo,
        bool bReplicateEndAbility,
        bool bWasCancelled
    ) override;
};

```

***BuffAbility.cpp***

```
#include "BuffAbility.h"
#include "StrengthBuffEffect.h"
#include "BuffCostEffect.h"
#include "AbilitySystemComponent.h"

UBuffAbility::UBuffAbility()
{
    // 인스턴싱 설정
    InstancingPolicy = EGameplayAbilityInstancingPolicy::InstancedPerActor;

    // Cost 설정 (마나 20 소모)
    CostGameplayEffectClass = UBuffCostEffect::StaticClass();

    // 쿨다운 없음 (중첩 가능하도록)
    CooldownGameplayEffectClass = nullptr;

    // 버프 Effect 설정
    BuffEffectClass = UStrengthBuffEffect::StaticClass();
}

void UBuffAbility::ActivateAbility(
    const FGameplayAbilitySpecHandle Handle,
    const FGameplayAbilityActorInfo* ActorInfo,
    const FGameplayAbilityActivationInfo ActivationInfo,
    const FGameplayEventData* TriggerEventData)
{
    // Cost 검증 (마나 20 소모)
    if (!CommitAbility(Handle, ActorInfo, ActivationInfo))
    {
        UE_LOG(LogTemp, Warning, TEXT("Buff failed: Insufficient mana"));
        EndAbility(Handle, ActorInfo, ActivationInfo, true, false);
        return;
    }

    // 버프 Effect 적용
    if (BuffEffectClass && ActorInfo->AbilitySystemComponent.IsValid())
    {
        FGameplayEffectContextHandle ContextHandle =
            ActorInfo->AbilitySystemComponent->MakeEffectContext();
        ContextHandle.AddSourceObject(this);

        FGameplayEffectSpecHandle SpecHandle =
            ActorInfo->AbilitySystemComponent->MakeOutgoingSpec(
                BuffEffectClass, 1, ContextHandle);

        if (SpecHandle.IsValid())
        {
            FActiveGameplayEffectHandle ActiveHandle =
                ActorInfo->AbilitySystemComponent->ApplyGameplayEffectSpecToSelf(
                    *SpecHandle.Data.Get());

            if (ActiveHandle.WasSuccessfullyApplied())
            {
                UE_LOG(LogTemp, Log, TEXT("Strength Buff applied! +50 Attack Power for 60 seconds"));
            }
        }
    }

    // 즉시 종료 (버프 Effect는 별도로 60초간 지속)
    EndAbility(Handle, ActorInfo, ActivationInfo, true, false);
}

void UBuffAbility::EndAbility(
    const FGameplayAbilitySpecHandle Handle,
    const FGameplayAbilityActorInfo* ActorInfo,
    const FGameplayAbilityActivationInfo ActivationInfo,
    bool bReplicateEndAbility,
    bool bWasCancelled)
{
    UE_LOG(LogTemp, Log, TEXT("Buff ability ended"));
    Super::EndAbility(Handle, ActorInfo, ActivationInfo, bReplicateEndAbility, bWasCancelled);
}

```


4. 캐릭터에 연결

***GASCahracter.h***에 추가

```
// 버프 스킬
UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "GAS")
TSubclassOf<UGameplayAbility> BuffAbilityClass;
```

***GASCharacter.cpp***에 추가

```
// 생성자에서 버프 스킬 설정
AGASCharacter::AGASCharacter()
{
    // ... 기존 코드 ...

    // 버프 스킬 클래스 지정
    BuffAbilityClass = UBuffAbility::StaticClass();
}

// 입력 처리에 B키 추가
void AGASCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    // ... 기존 코드 ...

    // B키로 버프 스킬 발동
    PlayerInputComponent->BindAction("Buff", IE_Pressed, this, &AGASCharacter::InputBuff);
}

// 버프 입력 처리 함수
void AGASCharacter::InputBuff()
{
    if (AbilitySystemComponent && BuffAbilityClass)
    {
        bool bSuccess = AbilitySystemComponent->TryActivateAbilityByClass(BuffAbilityClass);
        if (bSuccess)
        {
            UE_LOG(LogTemp, Log, TEXT("Buff ability activated"));
        }
        else
        {
            UE_LOG(LogTemp, Warning, TEXT("Buff ability failed (insufficient mana)"));
        }
    }
}
```

- UI에 연결하고 싶을때는?

```
// 버프 상태 확인 - 태그 기반
bool bHasStrengthBuff = AbilitySystemComponent->HasMatchingGameplayTag(
    FGameplayTag::RequestGameplayTag("Buff.Strength")
);

// 버프 스택 수 확인
int32 BuffStackCount = AbilitySystemComponent->GetGameplayEffectCount(
    UStrengthBuffEffect::StaticClass()
);

// 남은 시간 확인
float RemainingTime = AbilitySystemComponent->GetGameplayEffectDuration(ActiveHandle);
```


#### 전체 실행 흐름 복습

1. 플레이어 입력 -> ASC 요청

```
플레이어: H키 누름 (힐링 스킬)
         ↓
InputComponent: "Heal" 액션 감지
         ↓
GASCharacter::InputHeal(): ASC에 요청 전달
         ↓
ASC: "HealAbility 실행 가능한지 확인ㄱㄱ"
```

2. ASC의 조건 검사
	- ASC 내부 검사 과정

```
1. CanActivateAbility 체크
   - HealAbility가 등록되어 있나? ✓
   - 현재 상태가 정상인가? (스턴, 침묵 등) ✓
   - 다른 스킬과 충돌하지 않나? ✓

2. Cost 체크
   - 마나 40이 필요한데... 현재 마나는? 70 ✓
   - 충분하네, 계속 진행

3. Cooldown 체크
   - "Cooldown.Heal" 태그가 있나? 없음 ✓
   - 쿨다운 끝났으니 사용 가능
```

3. CommitAbility - 자원 차감 및 쿨다운 시작
	- CommitAbility 실행

```
1. Cost Effect 적용
   - HealCostEffect 생성
   - 마나 70 → 30 (즉시 차감)
   - Instant Effect이므로 바로 소멸

2. Cooldown Effect 적용
   - HealCooldownEffect 생성
   - "Cooldown.Heal" 태그 5초간 활성화
   - Duration Effect이므로 5초 후 자동 소멸 예약

3. ASC 상태 업데이트
   - "현재 힐링 스킬 실행 중" 마킹
```

4. Ability 실제 실행
	- HealAbility::ActivateAbility 실행

```
1. HealEffect 생성 및 적용
   - 체력 +80 회복 Effect 생성
   - ASC를 통해 AttributeSet에 적용
   - Health: 40 → 120 (즉시 회복)
   - Instant Effect이므로 바로 소멸

2. 시각/청각 피드백
   - 힐링 애니메이션 재생
   - 회복 이펙트 표시
   - 사운드 재생

3. Ability 종료
   - EndAbility 호출로 정리 작업
```

5. AttributeSet 자동 처리
	- AttributeSet 내부 동작

```
1. Health 값 변경 감지
   - 서버: Health 40 → 120
   - OnRep_Health 함수 준비

2. 네트워크 동기화
   - 서버 → 모든 클라이언트에 새로운 Health 값 전송
   - 클라이언트에서 OnRep_Health 자동 실행

3. UI 자동 업데이트
   - GAMEPLAYATTRIBUTE_REPNOTIFY 매크로 실행
   - 체력바 UI가 자동으로 40 → 120으로 업데이트
   - 관련 이벤트들 브로드캐스트
```

6. Effect 생명주기 관리
	- 시간이 지나면서 자동 관리

```
5초 후:
- HealCooldownEffect 자동 소멸
- "Cooldown.Heal" 태그 제거
- ASC: "이제 힐링 스킬 다시 사용 가능"

60초 후 (만약 버프가 있었다면):
- StrengthBuffEffect 자동 소멸
- 공격력 보너스 제거
- "Buff.Strength" 태그 제거
```