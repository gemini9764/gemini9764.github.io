---
title: GAS 정리
description: GAS
author: gemini
date: 2025-09-17 19:00:00 +09:00
categories: [Unreal]
tags: [GAS]
math: true
mermaid: true
---

#### GAS의 핵심 철학과 개념

##### GAS의 설계 철학

- Data-Driven Design (데이터 주도 설계)

```
// 기존 방식: 코드에 직접 작성
void FireballAbility::Execute() {
    float Damage = 50.0f;  // 데미지 바꾸려면 재컴파일 필요
    float Cooldown = 5.0f;  // 쿨다운 바꾸려면 재컴파일 필요
}

// GAS 방식: 데이터로 분리
// FireballEffect 블루프린트에서
// - Damage: 50 → 75 (에디터에서 바로 수정)
// - Cooldown: 5 → 3 (재컴파일 불필요)
```

- Separation of Concerns (관심사 분리)
	- GameplayEffect : 수치 변경만 담당 (데미지 계산)
	- GameplayCue : 시각/청각 효과만 담당 (이펙트, 사운드)
	- AbliltySystemComponent : 전체 조율만 담당
	- AttributeSet : 데이터 저장과 검증만 담당

- Composability (조합 가능성)

```
// 예: 화염 폭발 스킬 = 여러 Effect의 조합
FireExplosionAbility = {
    InitialDamageEffect,      // 즉시 데미지
    BurnEffect,               // 화상 DoT
    KnockbackEffect,          // 넉백
    AreaDenialEffect          // 장판 생성
};

// 각 Effect는 독립적으로 재사용 가능
// BurnEffect는 다른 화염 스킬에서도 사용
```


##### 5대 핵심 컴포넌트의 실제 역할

- AbilitySystemComponent (ASC)

```
// ASC의 핵심 데이터 구조 (개념 요약)
class UAbilitySystemComponent {
    FActiveGameplayEffectsContainer ActiveEffects;        // 활성화된 Effect들
    FGameplayAbilitySpecContainer   ActivatableAbilities; // 가진 Ability들
    FGameplayTagCountContainer      TagCountMap;          // 태그/스택
    TArray<UAttributeSet*>          AttributeSets;        // Attribute 세트들
};
```

- GameplayAbility (GA)
	- 언제(조건), 어떻게(정책), 무엇을(실행)

```
class UGameplayAbility : public UObject {
public:
    // 언제: 발동 조건
    FGameplayTagContainer ActivationRequiredTags;
    FGameplayTagContainer ActivationBlockedTags;

    // 무엇을: 실제 동작 (정식 시그니처)
    virtual void ActivateAbility(
        const FGameplayAbilitySpecHandle Handle,
        const FGameplayAbilityActorInfo* ActorInfo,
        const FGameplayAbilityActivationInfo ActivationInfo,
        const FGameplayEventData* TriggerEventData) override;

    virtual void EndAbility(
        const FGameplayAbilitySpecHandle Handle,
        const FGameplayAbilityActorInfo* ActorInfo,
        const FGameplayAbilityActivationInfo ActivationInfo,
        bool bReplicateEndAbility, bool bWasCancelled) override;

    // 어떻게: 실행 방식
    EGameplayAbilityInstancingPolicy   InstancingPolicy;
    EGameplayAbilityNetExecutionPolicy NetExecutionPolicy;

    // 사용 가능 체크/커밋 (정식 시그니처)
    virtual bool CanActivateAbility(
        const FGameplayAbilitySpecHandle Handle,
        const FGameplayAbilityActorInfo* ActorInfo,
        const FGameplayTagContainer* SourceTags = nullptr,
        const FGameplayTagContainer* TargetTags = nullptr,
        FGameplayTagContainer* OptionalRelevantTags = nullptr) const override;

    virtual bool CommitAbility(
        const FGameplayAbilitySpecHandle Handle,
        const FGameplayAbilityActorInfo* ActorInfo,
        const FGameplayAbilityActivationInfo ActivationInfo) override;
};
```

- GameplayEffect (GE)

```
class UGameplayEffect : public UObject {
public:
    // 얼마나 오래: Duration
    EGameplayEffectDurationType DurationPolicy;    // Instant / HasDuration / Infinite
    FScalableFloat              DurationMagnitude; // HasDuration일 때

    // 무엇을 바꿀지: Modifiers
    TArray<FGameplayModifierInfo> Modifiers;

    // 어떤 조건에서: 적용 요구/제외 태그
    FGameplayTagRequirements ApplicationTagRequirements;

    // 추가 효과: 부여 태그/면역/제거 태그 등
    FInheritedTagContainer InheritableOwnedTagsContainer;
    // 기타: GrantedApplicationImmunityTags, RemovalTagRequirements 등
};
```

- AttributeSet

```
class UMyAttributeSet : public UAttributeSet {
public:
    // 실제 데이터
    UPROPERTY(BlueprintReadOnly, Category="Attributes", ReplicatedUsing=OnRep_Health)
    FGameplayAttributeData Health;
    ATTRIBUTE_ACCESSORS(UMyAttributeSet, Health)

    // 검증 로직
    virtual void PreAttributeChange(const FGameplayAttribute& Attribute, float& NewValue) override;
    virtual void PostGameplayEffectExecute(const FGameplayEffectModCallbackData& Data) override;

    // 네트워크 동기화
    UFUNCTION()
    void OnRep_Health(const FGameplayAttributeData& OldHealth) {
        GAMEPLAYATTRIBUTE_REPNOTIFY(UMyAttributeSet, Health, OldHealth);
    }
};
```

- GameplayTag

```
// 태그 계층 구조
Status
├── Status.Buff
│   ├── Status.Buff.AttackUp
│   └── Status.Buff.DefenseUp
└── Status.Debuff
    ├── Status.Debuff.Stunned
    └── Status.Debuff.Slowed

// "Status.Debuff"를 체크하면 모든 디버프 확인 가능
```


#### 1대 핵심 - GAS AbilitySystemComponent (ASC)

##### ASC란?

- 캐릭터의 스킬, 스탯, 효과, 태그 - 이 모든 것을 ASC가 관리

```
// ASC는 이런 것들을 관리
- 어떤 스킬을 가지고 있나? (Abilities)
- 현재 스탯이 얼마나? (Attributes)
- 어떤 버프/디버프가 걸려있나? (Effects)
- 지금 무슨 상태인가? (Tags)
```

##### ASC 생성하고 초기화하기

1. ASC 생성

```
// Character 클래스에서
class AMyCharacter : public ACharacter {
    UPROPERTY()
    UAbilitySystemComponent* AbilitySystemComponent;

    AMyCharacter() {
        // ASC 컴포넌트 생성
        AbilitySystemComponent = CreateDefaultSubobject<UAbilitySystemComponent>(TEXT("ASC"));
    }
};
```

2. ASC 초기화

```
void AMyCharacter::BeginPlay() {
    Super::BeginPlay();

    // ASC 초기화 - 누가(Owner) 누구를(Avatar) 컨트롤하는지
    AbilitySystemComponent->InitAbilityActorInfo(this, this);
    // Owner: ASC를 소유한 액터 (보통 PlayerState나 Character)
    // Avatar: 실제 몸체가 되는 액터 (항상 Character/Pawn)
}
```


##### ASC의 위치

1. Character (싱글플레이어)

```
class AMyCharacter : public ACharacter {
    UPROPERTY()
    UAbilitySystemComponent* ASC;

    // 장점: 간단함
    // 단점: 캐릭터 죽으면 ASC도 사라짐
};
```

2. PlayerState (멀티플레이어)

```
class AMyPlayerState : public APlayerState, public IAbilitySystemInterface {
    GENERATED_BODY()
public:
    UPROPERTY()
    UAbilitySystemComponent* ASC;

    AMyPlayerState() {
        ASC = CreateDefaultSubobject<UAbilitySystemComponent>(TEXT("ASC"));
    }

    virtual UAbilitySystemComponent* GetAbilitySystemComponent() const override { return ASC; }
};

// Character에서 PlayerState의 ASC 가져오기
void AMyCharacter::PossessedBy(AController* NewController) {
    Super::PossessedBy(NewController);
    if (AMyPlayerState* PS = GetPlayerState<AMyPlayerState>()) {
        AbilitySystemComponent = PS->GetAbilitySystemComponent();
        AbilitySystemComponent->InitAbilityActorInfo(PS, this);
    }
}
```

3. 혼합 (추천)

```
void SetupASC() {
    if (IsPlayerControlled()) {
        // 플레이어는 PlayerState에
        ASC = PlayerState->GetAbilitySystemComponent();
    } else {
        // AI는 Character에
        ASC = GetAbilitySystemComponent();
    }
}
```


##### ASC의 주요 기능들

1. Ability 관리

```
// Ability 부여
FGameplayAbilitySpec AbilitySpec(FireballAbilityClass, 1);
FGameplayAbilitySpecHandle Handle = ASC->GiveAbility(AbilitySpec);

// Ability 실행 (클래스로)
ASC->TryActivateAbilityByClass(FireballAbilityClass);

// Tag로 실행 (함수명 복수형)
FGameplayTagContainer Tags;
Tags.AddTag(FGameplayTag::RequestGameplayTag(TEXT("Ability.Fireball")));
ASC->TryActivateAbilitiesByTag(Tags);

// Ability 제거
ASC->ClearAbility(Handle);
```

2. Effect 관리 (타겟 적용 정정)

```
// Effect Spec 생성
FGameplayEffectSpecHandle EffectSpec = ASC->MakeOutgoingSpec(
    DamageEffectClass,
    1.0f,  // Level
    ASC->MakeEffectContext()
);

// 자신에게 적용
ASC->ApplyGameplayEffectSpecToSelf(*EffectSpec.Data.Get());

// 다른 대상에게 적용 (정정: Target에 직접 ToSelf가 아니라 ToTarget 사용)
ASC->ApplyGameplayEffectSpecToTarget(*EffectSpec.Data.Get(), TargetASC);

// Effect 제거
ASC->RemoveActiveGameplayEffect(ActiveEffectHandle);
```

3. Attribute 관리

```
// AttributeSet 추가
ASC->InitStats(MyAttributeSetClass, AttributeDataTable);

// Attribute 값 가져오기
float Health = ASC->GetNumericAttribute(UMyAttributeSet::GetHealthAttribute());

// Attribute 값 설정
ASC->SetNumericAttributeBase(UMyAttributeSet::GetHealthAttribute(), 100.0f);

// Attribute 변경 감지
ASC->GetGameplayAttributeValueChangeDelegate(
    UMyAttributeSet::GetHealthAttribute()
).AddUObject(this, &ThisClass::OnHealthChanged);
```

4. Tag 관리

```
// Tag 추가
ASC->AddLooseGameplayTag(FGameplayTag::RequestGameplayTag(TEXT("Status.Stunned")));

// 복제가 필요한 경우 서버에서만 (클라이언트 로컬 추가는 복제되지 않음)
if (HasAuthority()) {
    ASC->AddLooseGameplayTag(FGameplayTag::RequestGameplayTag(TEXT("Status.Stunned")));
}

// Tag 제거
ASC->RemoveLooseGameplayTag(FGameplayTag::RequestGameplayTag(TEXT("Status.Stunned")));

// Tag 확인
bool bHasTag = ASC->HasMatchingGameplayTag(
    FGameplayTag::RequestGameplayTag(TEXT("Status.Stunned"))
);

// Tag 스택
ASC->SetLooseGameplayTagCount(FGameplayTag::RequestGameplayTag(TEXT("Stack.Poison")), 3);
int32 Stacks = ASC->GetTagCount(FGameplayTag::RequestGameplayTag(TEXT("Stack.Poison")));

// Tag 변경 이벤트
ASC->RegisterGameplayTagEvent(
    FGameplayTag::RequestGameplayTag(TEXT("Status.Stunned"))
).AddUObject(this, &ThisClass::OnStunTagChanged);
```


##### 네트워크 복제 (Replication)

- ASC는 멀티플레이어를 위한 자동 동기화를 제공한다

```
// ASC 컴포넌트 자체 복제 플래그
AbilitySystemComponent->SetIsReplicated(true);

// (권장) 서브오브젝트 복제 경로 보장
bool AMyCharacter::ReplicateSubobjects(UActorChannel* Channel, FOutBunch* Bunch, FReplicationFlags* RepFlags)
{
    bool WroteSomething = Super::ReplicateSubobjects(Channel, Bunch, RepFlags);
    if (AbilitySystemComponent)
    {
        WroteSomething |= Channel->ReplicateSubobject(AbilitySystemComponent, *Bunch, *RepFlags);
    }
    return WroteSomething;
}

// 복제 모드 설정
AbilitySystemComponent->SetReplicationMode(EGameplayEffectReplicationMode::Mixed);
// Full: 모든 Effect 복제 (싱글/소규모)
// Minimal: 자신의 Effect만 (대규모 멀티)
// Mixed: 권장
```


##### ASC 이벤트 시스템

```
// 1. Ability 커밋 이벤트
ASC->AbilityCommittedCallbacks.AddUObject(this, &ThisClass::OnAbilityCommitted);

// 2. Effect 적용 이벤트
ASC->OnGameplayEffectAppliedDelegateToSelf.AddUObject(
    this, &ThisClass::OnEffectApplied
);

// 3. Attribute 변경 이벤트
ASC->GetGameplayAttributeValueChangeDelegate(
    UMyAttributeSet::GetHealthAttribute()
).AddLambda([](const FOnAttributeChangeData& Data) {
    float OldValue = Data.OldValue;
    float NewValue = Data.NewValue;
    UE_LOG(LogTemp, Warning, TEXT("Health: %f -> %f"), OldValue, NewValue);
});

// 4. Tag 변경 이벤트
FDelegateHandle TagHandle = ASC->RegisterGameplayTagEvent(
    FGameplayTag::RequestGameplayTag(TEXT("Status.Dead"))
).AddLambda([](const FGameplayTag Tag, int32 Count) {
    if (Count > 0) {
        // 죽음 처리
    }
});
```


##### 실전 예제 - 전체 설정

```
// 1. Character 클래스
UCLASS()
class AMyGameCharacter : public ACharacter {
    GENERATED_BODY()

public:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
    UAbilitySystemComponent* AbilitySystemComponent;

    UPROPERTY()
    UMyAttributeSet* AttributeSet;

    AMyGameCharacter() {
        // ASC 생성
        AbilitySystemComponent = CreateDefaultSubobject<UAbilitySystemComponent>(TEXT("ASC"));
        AbilitySystemComponent->SetIsReplicated(true);

        // AttributeSet 생성
        AttributeSet = CreateDefaultSubobject<UMyAttributeSet>(TEXT("Attributes"));
    }

    virtual void BeginPlay() override {
        Super::BeginPlay();

        // ASC 초기화
        if (AbilitySystemComponent) {
            AbilitySystemComponent->InitAbilityActorInfo(this, this);

            // 기본 Ability 부여
            GiveDefaultAbilities();

            // 기본 스탯 초기화
            InitializeAttributes();

            // 기본 태그 설정
            AddStartupGameplayTags();
        }
    }

    virtual bool ReplicateSubobjects(UActorChannel* Channel, FOutBunch* Bunch, FReplicationFlags* RepFlags) override
    {
        bool WroteSomething = Super::ReplicateSubobjects(Channel, Bunch, RepFlags);
        if (AbilitySystemComponent)
        {
            WroteSomething |= Channel->ReplicateSubobject(AbilitySystemComponent, *Bunch, *RepFlags);
        }
        return WroteSomething;
    }

private:
    void GiveDefaultAbilities() {
        if (!HasAuthority()) return;

        for (TSubclassOf<UGameplayAbility>& AbilityClass : DefaultAbilities) {
            FGameplayAbilitySpec Spec(AbilityClass, 1);
            AbilitySystemComponent->GiveAbility(Spec);
        }
    }

    void InitializeAttributes() {
        // 데이터 테이블로 초기화
        if (DefaultAttributeDataTable) {
            AbilitySystemComponent->InitStats(
                UMyAttributeSet::StaticClass(),
                DefaultAttributeDataTable
            );
        }
    }

    void AddStartupGameplayTags() {
        if (HasAuthority()) {
            AbilitySystemComponent->AddLooseGameplayTag(
                FGameplayTag::RequestGameplayTag(TEXT("Character.State.Alive"))
            );
        }
    }

    UPROPERTY(EditDefaultsOnly)
    TArray<TSubclassOf<UGameplayAbility>> DefaultAbilities;

    UPROPERTY(EditDefaultsOnly)
    UDataTable* DefaultAttributeDataTable = nullptr;
};
```


#### 2대 핵심 - GAS GameplayAbility

##### GameplayAbility란?

- GameplayAbility는 **캐릭터가 할 수 있는 모든 행동**을 정의하는 클래스
- 공격, 스킬, 점프, 아이템 사용 - 이 모든 게 Ability


##### Ability의 생명주기

```
// 스킬 사용 과정
1. TryActivateAbility() - "스킬 쓰고 싶어!"
2. CanActivateAbility() - "쓸 수 있나 체크"
3. CommitAbility() - "코스트 지불"
4. ActivateAbility() - "실제 실행"
5. EndAbility() - "스킬 종료"
```


##### 각 단계 자세히 보기 (시그니처 보강)

```
// 1. CanActivateAbility - 사용 가능 체크
virtual bool CanActivateAbility(
    const FGameplayAbilitySpecHandle Handle,
    const FGameplayAbilityActorInfo* ActorInfo,
    const FGameplayTagContainer* SourceTags = nullptr,
    const FGameplayTagContainer* TargetTags = nullptr,
    FGameplayTagContainer* OptionalRelevantTags = nullptr) const override
{
    if (IsOnCooldown()) return false;             // 쿨다운 체크
    if (GetMana() < ManaCost) return false;       // 마나 체크
    if (ASC->HasMatchingGameplayTag(
        FGameplayTag::RequestGameplayTag(TEXT("Status.Stunned")))) return false; // 태그 조건
    return true;
}

// 2. CommitAbility - 코스트 지불
virtual bool CommitAbility(
    const FGameplayAbilitySpecHandle Handle,
    const FGameplayAbilityActorInfo* ActorInfo,
    const FGameplayAbilityActivationInfo ActivationInfo) override
{
    SetMana(GetMana() - ManaCost);
    StartCooldown(5.0f);
    return true;
}

// 3. ActivateAbility - 실제 동작
virtual void ActivateAbility(
    const FGameplayAbilitySpecHandle Handle,
    const FGameplayAbilityActorInfo* ActorInfo,
    const FGameplayAbilityActivationInfo ActivationInfo,
    const FGameplayEventData* TriggerEventData) override
{
    PlayMontage(AttackAnimation);
    SpawnProjectile();
    ApplyDamageEffect(Target);
}

// 4. EndAbility - 정리
virtual void EndAbility(
    const FGameplayAbilitySpecHandle Handle,
    const FGameplayAbilityActorInfo* ActorInfo,
    const FGameplayAbilityActivationInfo ActivationInfo,
    bool bReplicateEndAbility, bool bWasCancelled) override
{
    StopMontage();
    CleanupProjectiles();
}
```


##### Instancing Policy - 인스턴스 생성 방식

```
// 1. NonInstanced - 인스턴스 안 만듦
InstancingPolicy = EGameplayAbilityInstancingPolicy::NonInstanced;

// 2. InstancedPerActor - 액터당 1개
InstancingPolicy = EGameplayAbilityInstancingPolicy::InstancedPerActor;

// 3. InstancedPerExecution - 실행마다 생성
InstancingPolicy = EGameplayAbilityInstancingPolicy::InstancedPerExecution;
```


##### Input 연결하기

1. InputID 사용 (여전히 유효)

```
// 열거형 정의
enum EAbilityInputID {
    None = 0,
    Confirm = 1,
    Cancel = 2,
    Skill_Q = 3,
    Skill_W = 4,
    Skill_E = 5,
    Skill_R = 6
};

// Ability에 ID 할당
FGameplayAbilitySpec Spec(FireballAbility);
Spec.InputID = Skill_Q;  // Q키에 연결

// 입력 처리
void AMyCharacter::SetupPlayerInputComponent() {
    InputComponent->BindAction("Skill_Q", IE_Pressed, this,
        [this]() { ASC->AbilityLocalInputPressed(Skill_Q); });
}
```

2. InputTag 사용 (최신, 태그 요청 방식 정정)

```
// Ability에 태그 설정
AbilityTags.AddTag(FGameplayTag::RequestGameplayTag(TEXT("Input.Skill.Fireball")));

// 입력 발생 시
void OnFireballKeyPressed() {
    ASC->TryActivateAbilitiesByTag(
        FGameplayTagContainer(FGameplayTag::RequestGameplayTag(TEXT("Input.Skill.Fireball")))
    );
}
```


##### Ability Task - 비동기 작업

- 기본 제공 Task들

```
// 1. 대기
UAbilityTask_WaitDelay* DelayTask =
    UAbilityTask_WaitDelay::WaitDelay(this, 2.0f);
DelayTask->OnFinish.AddDynamic(this, &ThisClass::OnDelayComplete);
DelayTask->ReadyForActivation();

// 2. 타겟팅 (타겟 액터 클래스 인자 필요)
UAbilityTask_WaitTargetData* TargetTask =
    UAbilityTask_WaitTargetData::WaitTargetData(
        this, NAME_None, EGameplayTargetingConfirmation::UserConfirmed,
        AGameplayAbilityTargetActor::StaticClass());
TargetTask->ValidData.AddDynamic(this, &ThisClass::OnTargetSelected);
TargetTask->ReadyForActivation(); // :contentReference[oaicite:0]{index=0}

// 3. 애니메이션 대기
UAbilityTask_PlayMontageAndWait* MontageTask =
    UAbilityTask_PlayMontageAndWait::CreatePlayMontageAndWaitProxy(
        this, NAME_None, AttackMontage);
MontageTask->OnCompleted.AddDynamic(this, &ThisClass::OnAnimComplete);
MontageTask->ReadyForActivation(); // :contentReference[oaicite:1]{index=1}
```

- 커스텀 Task 만들기

```
// 예: 적 찾기 Task
class UTask_FindEnemies : public UAbilityTask {
public:
    static UTask_FindEnemies* FindEnemiesInRadius(
        UGameplayAbility* OwningAbility,
        float Radius) {

        UTask_FindEnemies* Task = NewAbilityTask<UTask_FindEnemies>(OwningAbility);
        Task->SearchRadius = Radius;
        return Task;
    }

    DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(
        FEnemiesFound, const TArray<AActor*>&, Enemies);

    UPROPERTY(BlueprintAssignable)
    FEnemiesFound OnEnemiesFound;

    virtual void Activate() override {
        TArray<AActor*> Enemies = FindEnemiesInRadius(SearchRadius);
        OnEnemiesFound.Broadcast(Enemies);
        EndTask();
    }

private:
    float SearchRadius = 1000.f;
};
```

- 네트워크 실행 정책

```
NetExecutionPolicy = EGameplayAbilityNetExecutionPolicy::LocalOnly;
NetExecutionPolicy = EGameplayAbilityNetExecutionPolicy::LocalPredicted;
NetExecutionPolicy = EGameplayAbilityNetExecutionPolicy::ServerOnly;
NetExecutionPolicy = EGameplayAbilityNetExecutionPolicy::ServerInitiated;
```


##### 실전 예제 - 화염구 스킬 (TargetData/배열 접근 정정)

```
#include "AbilitySystemBlueprintLibrary.h"

class UGA_Fireball : public UGameplayAbility {
    UGA_Fireball() {
        InstancingPolicy   = EGameplayAbilityInstancingPolicy::InstancedPerExecution;
        NetExecutionPolicy = EGameplayAbilityNetExecutionPolicy::LocalPredicted;

        AbilityTags.AddTag(FGameplayTag::RequestGameplayTag(TEXT("Ability.Skill.Fireball")));
        ActivationBlockedTags.AddTag(FGameplayTag::RequestGameplayTag(TEXT("Status.Silenced")));

        // 코스트/쿨다운 GE 클래스 사용 (UGameplayAbility의 표준 속성)
        CostGameplayEffectClass     = ManaCostEffect;
        CooldownGameplayEffectClass = FireballCooldownEffect;
    }

    void ActivateAbility(const FGameplayAbilitySpecHandle Handle,
                        const FGameplayAbilityActorInfo* ActorInfo,
                        const FGameplayAbilityActivationInfo ActivationInfo,
                        const FGameplayEventData* TriggerEventData) override
    {
        // 1. 애니메이션 재생
        UAbilityTask_PlayMontageAndWait* MontageTask =
            UAbilityTask_PlayMontageAndWait::CreatePlayMontageAndWaitProxy(
                this, NAME_None, CastMontage);
        MontageTask->OnCompleted.AddDynamic(this, &ThisClass::OnCastComplete);
        MontageTask->ReadyForActivation();
    }

    UFUNCTION()
    void OnCastComplete() {
        // 2. 타겟팅
        UAbilityTask_WaitTargetData* TargetTask =
            UAbilityTask_WaitTargetData::WaitTargetData(
                this, NAME_None, EGameplayTargetingConfirmation::UserConfirmed,
                AGameplayAbilityTargetActor::StaticClass());
        TargetTask->ValidData.AddDynamic(this, &ThisClass::OnTargetAcquired);
        TargetTask->ReadyForActivation();
    }

    UFUNCTION()
    void OnTargetAcquired(const FGameplayAbilityTargetDataHandle& Data) {
        // 3. 발사체 생성
        FTransform SpawnTransform = GetAvatarActorFromActorInfo()->GetTransform();
        AFireballProjectile* Fireball = GetWorld()->SpawnActor<AFireballProjectile>(
            FireballClass, SpawnTransform);

        // 4. 타겟 추출 (핸들 래퍼 함수 사용)
        TArray<AActor*> Targets = UAbilitySystemBlueprintLibrary::GetAllActorsFromTargetData(Data);
        if (Targets.Num() > 0) {
            Fireball->Target = Targets[0];
        }

        // 5. 데미지 설정
        Fireball->Damage = 100.0f;

        // 6. 스킬 종료
        EndAbility(CurrentSpecHandle, CurrentActorInfo, CurrentActivationInfo, true, false);
    }
};

```


##### Trigger - 자동 발동

```
// 피격 시 자동 발동하는 반격 스킬
class UGA_CounterAttack : public UGameplayAbility {
    UGA_CounterAttack() {
        FAbilityTriggerData Trigger;
        Trigger.TriggerTag    = FGameplayTag::RequestGameplayTag(TEXT("Event.Damage.Received"));
        Trigger.TriggerSource = EGameplayAbilityTriggerSource::GameplayEvent;
        Triggers.Add(Trigger);
    }

    void ActivateAbility(const FGameplayAbilitySpecHandle Handle,
                        const FGameplayAbilityActorInfo* ActorInfo,
                        const FGameplayAbilityActivationInfo ActivationInfo,
                        const FGameplayEventData* TriggerEventData) override
    {
        DealDamageToAttacker();
    }
};

// 피격 이벤트 보내기
void OnDamageReceived(AActor* Attacker, float Damage) {
    FGameplayEventData EventData;
    EventData.EventTag       = FGameplayTag::RequestGameplayTag(TEXT("Event.Damage.Received"));
    EventData.Instigator     = Attacker;
    EventData.EventMagnitude = Damage;

    ASC->HandleGameplayEvent(EventData.EventTag, &EventData);
}
```


#### 3대 핵심 - GAS GameplayEffect

##### GameplayEffect란?

- GameplayEffect (줄여서 GE)는 **캐릭터의 스탯을 변경하는 명령서
- 데미지 주기, 힐하기, 버프 걸기, 디버프 걸기 - 이 모든 게 GameplayEffect

```
// 예시: 50 데미지를 주는 Effect를 Spec으로 만들어 적용
```


##### GameplayEffect의 3가지 타입

1. Instant (즉시)

```
DurationPolicy = EGameplayEffectDurationType::Instant;
// 한 번 적용하고 끝
```

2. Duration (지속)

```
DurationPolicy     = EGameplayEffectDurationType::HasDuration;
DurationMagnitude  = FScalableFloat(10.0f);  // (정정: SetValue 대신 ScalableFloat)
```

3. Infinite (무한)

```
DurationPolicy = EGameplayEffectDurationType::Infinite;
```


##### GameplayEffect 적용 과정

1. Effect 준비

```
// "데미지 값 SetByCaller" 방식으로 준비
FGameplayEffectSpecHandle DamageSpec = ASC->MakeOutgoingSpec(DamageEffect, 1.0f, ASC->MakeEffectContext());
DamageSpec.Data->SetSetByCallerMagnitude(
    FGameplayTag::RequestGameplayTag(TEXT("Data.Damage")), 50.0f); // 런타임 전달
```

2. 적용 가능한지 체크

```
if (Target->IsDead()) return;
if (Target->IsInvulnerable()) return;
```

3. ApplicationTagRequirement 구조

```
class UGE_DamageEffect : public UGameplayEffect {
    UGE_DamageEffect() {
        // 적용 조건 설정
        FGameplayTagRequirements TagRequirements;

        // RequireTags: 반드시 있어야 하는 태그들
        TagRequirements.RequireTags.AddTag(
            FGameplayTag::RequestGameplayTag(TEXT("State.Alive"))
        );
        TagRequirements.RequireTags.AddTag(
            FGameplayTag::RequestGameplayTag(TEXT("State.Targetable"))
        );

        // IgnoreTags: 하나라도 있으면 적용 안 됨
        TagRequirements.IgnoreTags.AddTag(
            FGameplayTag::RequestGameplayTag(TEXT("Status.Invulnerable"))
        );
        TagRequirements.IgnoreTags.AddTag(
            FGameplayTag::RequestGameplayTag(TEXT("Status.Dead"))
        );
        TagRequirements.IgnoreTags.AddTag(
            FGameplayTag::RequestGameplayTag(TEXT("Status.PhaseShift"))
        );

        ApplicationTagRequirements = TagRequirements;
    }
};
```

- 이렇게 설정하면
	- State.Alive와 State.Targetable 태그가 모두 있어야만 적용
	- Status.Invulnerable, Status.Dead, Status.PhaseShift 중 하나라도 있으면 적용 거부

- ApplicationTagRequirements의 장점
	1. 중앙 집중식 관리 - Effect 정의에 모든 조건이 명시
	2. 자동 체크 - ASC가 알아서 조건 확인
	3. 네트워크 안전 - 서버/클라이언트 동일한 로직
	4. 확장성 - 새 조건은 태그만 추가하면 됨
	5. 재사용성 - 같은 조건을 여러 Effect가 공유

- SourceTags vs TargetTags

```
// Source(시전자)와 Target(대상)을 구분해서 체크
class UGE_HolyDamage : public UGameplayEffect {
    UGE_HolyDamage() {
        // Source 조건 - 시전자가 성직자여야 함
        FGameplayTagRequirements SourceReqs;
        SourceReqs.RequireTags.AddTag(
            FGameplayTag::RequestGameplayTag(TEXT("Class.Priest"))
        );

        // Target 조건 - 대상이 언데드여야 함
        FGameplayTagRequirements TargetReqs;
        TargetReqs.RequireTags.AddTag(
            FGameplayTag::RequestGameplayTag(TEXT("Type.Undead"))
        );

        SourceTagRequirements = SourceReqs;
        TargetTagRequirements = TargetReqs;
    }
};
```

- OngoingTagRequirements - 지속 중 조건

```
class UGE_Channeling : public UGameplayEffect {
    UGE_Channeling() {
        DurationPolicy = EGameplayEffectDurationType::HasDuration;

        // 지속 중에도 계속 체크
        FGameplayTagRequirements OngoingReqs;
        OngoingReqs.RequireTags.AddTag(
            FGameplayTag::RequestGameplayTag(TEXT("State.Channeling"))
        );
        OngoingReqs.IgnoreTags.AddTag(
            FGameplayTag::RequestGameplayTag(TEXT("Status.Stunned"))
        );

        OngoingTagRequirements = OngoingReqs;
        // 채널링 중단되거나 스턴 걸리면 Effect 자동 종료
    }
};
```

- RemovalTagRequirements - 제거 조건

```
class UGE_Curse : public UGameplayEffect {
    UGE_Curse() {
        DurationPolicy = EGameplayEffectDurationType::Infinite;

        // 이 태그가 생기면 자동 제거
        FGameplayTagRequirements RemovalReqs;
        RemovalReqs.RequireTags.AddTag(
            FGameplayTag::RequestGameplayTag(TEXT("Action.Dispel"))
        );

        RemovalTagRequirements = RemovalReqs;
        // 디스펠 시전하면 저주 자동 해제
    }
};
```


##### 실전 예시 - 복잡한 조건의 스킬

```
class UGE_AssassinateEffect : public UGameplayEffect {
    UGE_AssassinateEffect() {
        // 즉사 효과

        // 시전자: 도적이고, 은신 중이어야 함
        SourceTagRequirements.RequireTags.AddTag(
            FGameplayTag::RequestGameplayTag(TEXT("Class.Rogue"))
        );
        SourceTagRequirements.RequireTags.AddTag(
            FGameplayTag::RequestGameplayTag(TEXT("State.Stealth"))
        );

        // 대상: 체력 30% 이하, 보스 아님, 언데드 아님
        TargetTagRequirements.RequireTags.AddTag(
            FGameplayTag::RequestGameplayTag(TEXT("Health.Low"))
        );
        TargetTagRequirements.IgnoreTags.AddTag(
            FGameplayTag::RequestGameplayTag(TEXT("Type.Boss"))
        );
        TargetTagRequirements.IgnoreTags.AddTag(
            FGameplayTag::RequestGameplayTag(TEXT("Type.Undead"))
        );

        // 적용 시 은신 해제
        RemoveGameplayEffectsWithTags.AddTag(
            FGameplayTag::RequestGameplayTag(TEXT("Effect.Stealth"))
        );
    }
};
```

***이 모든 조건이 자동으로 체크된다***

- 실제 적용

```
ASC->ApplyGameplayEffectSpecToTarget(*DamageSpec.Data.Get(), Target->GetAbilitySystemComponent());
// 1) Health 감소, 2) 피격 이펙트, 3) UI 업데이트, 4) 사망 체크 등
```


##### Modifier - 어떻게 바꿀 것인가

```
// Additive / Multiplicative / Division / Override
```


##### SetByCaller - 동적으로 값 전달하기 (표준 API 사용)

```
// Effect 정의 예 (개념)
// DamageModifier.ModifierMagnitude는 SetByCaller(태그 "Data.Damage")로 설정

// 사용할 때 (런타임에 값 주입)
void DealDamage(float Amount) {
    FGameplayEffectSpecHandle Spec = ASC->MakeOutgoingSpec(DamageEffect, 1.0f, ASC->MakeEffectContext());
    Spec.Data->SetSetByCallerMagnitude(FGameplayTag::RequestGameplayTag(TEXT("Data.Damage")), Amount);
    ASC->ApplyGameplayEffectSpecToTarget(*Spec.Data.Get(), TargetASC);
}
```


##### Period - 주기적 효과 (DoT/HoT)

```
// 독 효과: 10초 동안 1초마다 5 데미지
class UGE_Poison : public UGameplayEffect {
    UGE_Poison() {
        DurationPolicy    = EGameplayEffectDurationType::HasDuration;
        DurationMagnitude = FScalableFloat(10.0f);
        Period            = 1.0f;

        FGameplayModifierInfo HealthModifier;
        HealthModifier.Attribute        = UMyAttributeSet::GetHealthAttribute();
        HealthModifier.ModifierOp       = EGameplayModOp::Additive;
        HealthModifier.ModifierMagnitude = FGameplayEffectModifierMagnitude(FScalableFloat(-5.0f));
        Modifiers.Add(HealthModifier);
    }
};
```

- 첫 틱 타이밍

```
bExecutePeriodicEffectOnApplication = true;  // 즉시 첫 틱
// false면 Period 후 첫 틱
```


##### 전체 예시 - 화염 도트 데미지 (클래스/필드 정정)

```
class UGE_BurningEffect : public UGameplayEffect {
    UGE_BurningEffect() {
        DurationPolicy    = EGameplayEffectDurationType::HasDuration;
        DurationMagnitude = FScalableFloat(5.0f);

        Period = 0.5f;
        bExecutePeriodicEffectOnApplication = true;

        FGameplayModifierInfo HealthMod;
        HealthMod.Attribute         = UMyAttributeSet::GetHealthAttribute();
        HealthMod.ModifierOp        = EGameplayModOp::Additive;
        HealthMod.ModifierMagnitude = FGameplayEffectModifierMagnitude(FScalableFloat(-3.0f));
        Modifiers.Add(HealthMod);

        InheritableOwnedTagsContainer.AddTag(FGameplayTag::RequestGameplayTag(TEXT("Status.Burning")));
    }
};

// 사용
void ApplyBurn(AActor* Target) {
    FGameplayEffectSpecHandle BurnSpec = ASC->MakeOutgoingSpec(BurningEffect, 1.0f, ASC->MakeEffectContext());
    Target->GetAbilitySystemComponent()->ApplyGameplayEffectSpecToSelf(*BurnSpec.Data.Get());
}
```


#### 4대 핵심 - GAS AttributeSet

##### AttributeSet이란?

```
class UMyAttributeSet : public UAttributeSet {
    UPROPERTY(BlueprintReadOnly, Category="Attributes", ReplicatedUsing=OnRep_Health)
    FGameplayAttributeData Health;      // 체력
    ATTRIBUTE_ACCESSORS(UMyAttributeSet, Health)

    UPROPERTY(BlueprintReadOnly, Category="Attributes")
    FGameplayAttributeData MaxHealth;   // 최대 체력
    ATTRIBUTE_ACCESSORS(UMyAttributeSet, MaxHealth)

    UPROPERTY(BlueprintReadOnly, Category="Attributes")
    FGameplayAttributeData AttackPower; // 공격력
    ATTRIBUTE_ACCESSORS(UMyAttributeSet, AttackPower)

    UFUNCTION()
    void OnRep_Health(const FGameplayAttributeData& OldHealth) {
        GAMEPLAYATTRIBUTE_REPNOTIFY(UMyAttributeSet, Health, OldHealth);
    }
};
```


#### 매크로를 사용하는 이유

```
// 매크로 없이 직접 쓰면
class UMyAttributeSet : public UAttributeSet {
    FGameplayAttributeData Health;

    // Health를 위한 함수 4개를 직접 만들어야 함
    static FGameplayAttribute GetHealthAttribute();
    float GetHealth() const;
    void SetHealth(float NewVal);
    void InitHealth(float NewVal);

    // MaxHealth를 위한 함수 4개
    static FGameplayAttribute GetMaxHealthAttribute();
    float GetMaxHealth() const;
    void SetMaxHealth(float NewVal);
    void InitMaxHealth(float NewVal);

    // AttackPower를 위한 함수 4개...
    // 스탯 10개면 함수 40개...
};

// 매크로 사용하면
class UMyAttributeSet : public UAttributeSet {
    FGameplayAttributeData Health;
    ATTRIBUTE_ACCESSORS(UMyAttributeSet, Health)  // 이 한 줄이 4개 함수 자동 생성

    FGameplayAttributeData MaxHealth;
    ATTRIBUTE_ACCESSORS(UMyAttributeSet, MaxHealth)  // 또 4개 자동 생성
};
```


##### 스탯이 변경되는 과정

1. Effect가 적용됨

```
ApplyDamageEffect(50);
```

2. PreAttributeChange 호출

```
void PreAttributeChange(const FGameplayAttribute& Attribute, float& NewValue) override {
    if (Attribute == GetHealthAttribute()) {
        NewValue = FMath::Max(NewValue, 0.0f);
    }
}
```

3. PostGameplayEffectExecute 호출

```
void PostGameplayEffectExecute(const FGameplayEffectModCallbackData& Data) override {
    if (Data.EvaluatedData.Attribute == GetHealthAttribute()) {
        if (GetHealth() <= 0) {
            // 사망 처리
        }
    }
}
```


##### Meta Attribute란?

```
class UMyAttributeSet : public UAttributeSet {
    UPROPERTY(BlueprintReadOnly, Category="Meta")
    FGameplayAttributeData Damage;  // Meta

    // ...
};

void UMyAttributeSet::PostGameplayEffectExecute(const FGameplayEffectModCallbackData& Data) {
    if (Data.EvaluatedData.Attribute == GetDamageAttribute()) {
        const float DamageValue = GetDamage();
        SetDamage(0.f);  // 소모 후 리셋

        const float FinalDamage = DamageValue - GetDefense();
        SetHealth(GetHealth() - FinalDamage);
    }
}
```


#### 5대 핵심 - GAS 태그 시스템

##### 태그를 붙이는 3곳

1. ASC (캐릭터)에 붙이는 태그

```
ASC->AddLooseGameplayTag(FGameplayTag::RequestGameplayTag(TEXT("Character.State.Alive")));

if (HasAuthority()) {
    ASC->AddLooseGameplayTag(FGameplayTag::RequestGameplayTag(TEXT("Status.Poisoned")));
}
```

2. GameplayAbility에 붙이는 태그

```
class UMyAbility : public UGameplayAbility {
    UMyAbility() {
        AbilityTags.AddTag(FGameplayTag::RequestGameplayTag(TEXT("Ability.Dash")));
        ActivationRequiredTags.AddTag(FGameplayTag::RequestGameplayTag(TEXT("State.Alive")));
        ActivationBlockedTags.AddTag(FGameplayTag::RequestGameplayTag(TEXT("Status.Stunned")));
        ActivationOwnedTags.AddTag(FGameplayTag::RequestGameplayTag(TEXT("State.Dashing")));
    }
};
```

3. GameplayEffect에 붙이는 태그

```
class UMyEffect : public UGameplayEffect {
    UMyEffect() {
        ApplicationTagRequirements.RequireTags.AddTag(FGameplayTag::RequestGameplayTag(TEXT("State.Alive")));
        InheritableOwnedTagsContainer.AddTag(FGameplayTag::RequestGameplayTag(TEXT("Status.Burning")));
    }
};
```


##### 태그의 종류별 정리

- GameplayAbility의 태그들 (9종류)

```
// 1. AbilityTags - 이 스킬을 식별하는 태그 (다른 시스템이 이 스킬을 찾을 때 사용)
AbilityTags.AddTag(FGameplayTag::RequestGameplayTag(TEXT("Ability.Fireball")));

// 2. ActivationRequiredTags - 캐릭터가 반드시 가져야 스킬 사용 가능한 태그들
ActivationRequiredTags.AddTag(FGameplayTag::RequestGameplayTag(TEXT("State.Alive")));

// 3. ActivationBlockedTags - 캐릭터가 하나라도 가지면 스킬 사용 불가한 태그들
ActivationBlockedTags.AddTag(FGameplayTag::RequestGameplayTag(TEXT("Status.Silenced")));

// 4. SourceRequiredTags - 시전자가 반드시 가져야 하는 태그들
SourceRequiredTags.AddTag(FGameplayTag::RequestGameplayTag(TEXT("Class.Mage")));

// 5. SourceBlockedTags - 시전자가 가지면 스킬 사용 불가한 태그들
SourceBlockedTags.AddTag(FGameplayTag::RequestGameplayTag(TEXT("Debuff.Disarmed")));

// 6. TargetRequiredTags - 대상이 반드시 가져야 스킬 적용 가능한 태그들
TargetRequiredTags.AddTag(FGameplayTag::RequestGameplayTag(TEXT("Type.Enemy")));

// 7. TargetBlockedTags - 대상이 가지면 스킬 적용 불가한 태그들
TargetBlockedTags.AddTag(FGameplayTag::RequestGameplayTag(TEXT("Status.Invulnerable")));

// 8. CancelAbilitiesWithTag - 이 스킬 발동 시 해당 태그의 다른 스킬들을 취소
CancelAbilitiesWithTag.AddTag(FGameplayTag::RequestGameplayTag(TEXT("Ability.Channeling")));

// 9. BlockAbilitiesWithTag - 이 스킬 활성화 중 해당 태그의 스킬 사용 차단
BlockAbilitiesWithTag.AddTag(FGameplayTag::RequestGameplayTag(TEXT("Ability.Movement")));
```

- GameplayEffect의 태그들 (7종류)

```
// 1. AssetTags - 이 Effect를 식별하는 태그 (디버깅/로그용)
AssetTags.AddTag(FGameplayTag::RequestGameplayTag(TEXT("Effect.Damage.Fire")));

// 2. InheritableOwnedTagsContainer - Effect 지속 중 대상에게 부여되는 태그들
InheritableOwnedTagsContainer.AddTag(FGameplayTag::RequestGameplayTag(TEXT("Status.Burning")));

// 3. RemoveGameplayEffectsWithTags - 이 Effect 적용 시 제거할 다른 Effect들의 태그
RemoveGameplayEffectsWithTags.AddTag(FGameplayTag::RequestGameplayTag(TEXT("Status.Debuff")));

// 4. ApplicationTagRequirements.RequireTags - 대상이 가져야 Effect 적용 가능한 태그들
ApplicationTagRequirements.RequireTags.AddTag(FGameplayTag::RequestGameplayTag(TEXT("State.Alive")));

// 5. ApplicationTagRequirements.IgnoreTags - 대상이 가지면 Effect 적용 불가한 태그들
ApplicationTagRequirements.IgnoreTags.AddTag(FGameplayTag::RequestGameplayTag(TEXT("Status.Immune")));

// 6. OngoingTagRequirements.RequireTags - Duration/Infinite Effect가 계속 유지되려면 필요한 태그들
OngoingTagRequirements.RequireTags.AddTag(FGameplayTag::RequestGameplayTag(TEXT("State.InCombat")));

// 7. RemovalTagRequirements.RequireTags - 이 태그가 생기면 Effect 자동 제거
RemovalTagRequirements.RequireTags.AddTag(FGameplayTag::RequestGameplayTag(TEXT("Action.Dispel")));

// 8. GrantedApplicationImmunityTags - 이 Effect가 부여하는 면역 태그들
GrantedApplicationImmunityTags.AddTag(FGameplayTag::RequestGameplayTag(TEXT("Type.Poison")));
```

- ASC의 태그 관리

```
// 1. Loose Gameplay Tags - 수동으로 추가/제거하는 태그 (Effect/Ability와 무관)
ASC->AddLooseGameplayTag(FGameplayTag::RequestGameplayTag(TEXT("Debug.Invincible")));
ASC->RemoveLooseGameplayTag(FGameplayTag::RequestGameplayTag(TEXT("Debug.Invincible")));

// 2. Granted Tags - GameplayEffect가 부여하는 태그 (Effect 지속 동안만 유지)
// Effect 설정 (생성자에서):
InheritableOwnedTagsContainer.AddTag(FGameplayTag::RequestGameplayTag(TEXT("Status.Stunned")));
// Effect 적용:
ASC->ApplyGameplayEffectToSelf(StunEffect, 1.0f, ASC->MakeEffectContext());

// 3. Activation Owned Tags - Ability 실행 중에만 부여되는 태그
// Ability 설정 (생성자에서):
ActivationOwnedTags.AddTag(FGameplayTag::RequestGameplayTag(TEXT("State.Dashing")));
// Ability 실행:
ASC->TryActivateAbilityByClass(DashAbilityClass);  // 자동으로 태그 추가/제거됨

// 4. Aggregated/Owned Tags - 위 3가지의 합집합 (읽기 전용)
FGameplayTagContainer CurrentTags;
ASC->GetOwnedGameplayTags(CurrentTags);  // Loose + Granted + ActivationOwned 전부

// 5. Replicated Tags - 네트워크로 동기화되는 태그들
ASC->SetReplicatedLooseGameplayTags(TagContainer);  // 서버에서 설정
ASC->GetReplicatedLooseGameplayTags();  // 클라이언트에서 읽기

// 6. Blocked/Required/Cancel 관계 태그 - Ability 발동 조건 제어
// GameplayAbility 클래스에서 설정:
ActivationRequiredTags.AddTag(FGameplayTag::RequestGameplayTag(TEXT("State.Alive")));
ActivationBlockedTags.AddTag(FGameplayTag::RequestGameplayTag(TEXT("Status.Stunned")));
BlockAbilitiesWithTag.AddTag(FGameplayTag::RequestGameplayTag(TEXT("Ability.Movement")));
CancelAbilitiesWithTag.AddTag(FGameplayTag::RequestGameplayTag(TEXT("Ability.Channel")));
```


##### 태그 흐름 예시 - 스턴 걸리는 과정

```
// 1. 스턴 스킬 사용
PlayerASC->TryActivateAbilitiesByTag(
    FGameplayTagContainer(FGameplayTag::RequestGameplayTag(TEXT("Ability.Stun"))));

// 2. 스턴 어빌리티 체크
StunAbility {
    ActivationRequiredTags = [FGameplayTag::RequestGameplayTag(TEXT("State.Alive"))];
    TargetRequiredTags     = [FGameplayTag::RequestGameplayTag(TEXT("Type.Enemy"))];
}

// 3. 스턴 이펙트 적용
StunEffect {
    ApplicationTagRequirements.RequireTags.AddTag(FGameplayTag::RequestGameplayTag(TEXT("State.Alive")));
    InheritableOwnedTagsContainer.AddTag(FGameplayTag::RequestGameplayTag(TEXT("Status.Stunned")));
    InheritableOwnedTagsContainer.AddTag(FGameplayTag::RequestGameplayTag(TEXT("Disable.Movement")));
}

// 4. 대상 ASC에 태그 추가됨
// ["Status.Stunned", "Disable.Movement"]

// 5. 이동 스킬이 차단됨
DashAbility {
    ActivationBlockedTags = [FGameplayTag::RequestGameplayTag(TEXT("Status.Stunned"))];
}
```

- 태그 계층 구조 활용

```
Status
├── Status.Buff
│   ├── Status.Buff.Attack
│   └── Status.Buff.Defense
└── Status.Debuff
    ├── Status.Debuff.Stun
    └── Status.Debuff.Slow

// 모든 디버프 제거
ASC->RemoveActiveEffectsWithGrantedTags(
    FGameplayTagContainer(FGameplayTag::RequestGameplayTag(TEXT("Status.Debuff"))));
```


##### 실전 시나리오

- 시나리오 : 화염 + 기름 = 폭발

```
// 1. 기름 웅덩이 밟음 → "Status.Oiled"

// 2. 화염 공격 받음
FireballAbility 실행 {
    if (Target->ASC->HasMatchingGameplayTag(
        FGameplayTag::RequestGameplayTag(TEXT("Status.Oiled")))) {
        ApplyEffect(ExplosionEffect);
    }
}

// 3. 폭발 효과
ExplosionEffect {
    RemoveGameplayEffectsWithTags.AddTag(FGameplayTag::RequestGameplayTag(TEXT("Status.Oiled")));
    InheritableOwnedTagsContainer.AddTag(FGameplayTag::RequestGameplayTag(TEXT("Status.Stunned")));
}
```


#### 종합 코드

1. AttributeSet - 캐릭터 스탯 시스템

*GASAttributeSet.h*

```
#pragma once

#include "CoreMinimal.h"
#include "AttributeSet.h"
#include "AbilitySystemComponent.h"
#include "GASAttributeSet.generated.h"

#define ATTRIBUTE_ACCESSORS(ClassName, PropertyName) \
    GAMEPLAYATTRIBUTE_PROPERTY_GETTER(ClassName, PropertyName) \
    GAMEPLAYATTRIBUTE_VALUE_GETTER(PropertyName) \
    GAMEPLAYATTRIBUTE_VALUE_SETTER(PropertyName) \
    GAMEPLAYATTRIBUTE_VALUE_INITTER(PropertyName)

UCLASS()
class GASPROJECT_API UGASAttributeSet : public UAttributeSet
{
    GENERATED_BODY()

public:
    UGASAttributeSet();

    // 체력
    UPROPERTY(BlueprintReadOnly, Category="Health", ReplicatedUsing=OnRep_Health)
    FGameplayAttributeData Health;
    ATTRIBUTE_ACCESSORS(UGASAttributeSet, Health)

    // 최대 체력
    UPROPERTY(BlueprintReadOnly, Category="Health", ReplicatedUsing=OnRep_MaxHealth)
    FGameplayAttributeData MaxHealth;
    ATTRIBUTE_ACCESSORS(UGASAttributeSet, MaxHealth)

    // 마나
    UPROPERTY(BlueprintReadOnly, Category="Mana", ReplicatedUsing=OnRep_Mana)
    FGameplayAttributeData Mana;
    ATTRIBUTE_ACCESSORS(UGASAttributeSet, Mana)

    // 최대 마나
    UPROPERTY(BlueprintReadOnly, Category="Mana", ReplicatedUsing=OnRep_MaxMana)
    FGameplayAttributeData MaxMana;
    ATTRIBUTE_ACCESSORS(UGASAttributeSet, MaxMana)

    // 스태미나
    UPROPERTY(BlueprintReadOnly, Category="Stamina", ReplicatedUsing=OnRep_Stamina)
    FGameplayAttributeData Stamina;
    ATTRIBUTE_ACCESSORS(UGASAttributeSet, Stamina)

    // 최대 스태미나
    UPROPERTY(BlueprintReadOnly, Category="Stamina", ReplicatedUsing=OnRep_MaxStamina)
    FGameplayAttributeData MaxStamina;
    ATTRIBUTE_ACCESSORS(UGASAttributeSet, MaxStamina)

    // 공격력
    UPROPERTY(BlueprintReadOnly, Category="Combat", ReplicatedUsing=OnRep_AttackPower)
    FGameplayAttributeData AttackPower;
    ATTRIBUTE_ACCESSORS(UGASAttributeSet, AttackPower)

protected:
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
    virtual void PreAttributeChange(const FGameplayAttribute& Attribute, float& NewValue) override;
    virtual void PostGameplayEffectExecute(const struct FGameplayEffectModCallbackData& Data) override;

    UFUNCTION() virtual void OnRep_Health(const FGameplayAttributeData& OldHealth);
    UFUNCTION() virtual void OnRep_MaxHealth(const FGameplayAttributeData& OldMaxHealth);
    UFUNCTION() virtual void OnRep_Mana(const FGameplayAttributeData& OldMana);
    UFUNCTION() virtual void OnRep_MaxMana(const FGameplayAttributeData& OldMaxMana);
    UFUNCTION() virtual void OnRep_Stamina(const FGameplayAttributeData& OldStamina);
    UFUNCTION() virtual void OnRep_MaxStamina(const FGameplayAttributeData& OldMaxStamina);
    UFUNCTION() virtual void OnRep_AttackPower(const FGameplayAttributeData& OldAttackPower);
};

```

*GASAttributeSet.cpp*

```
#include "GAS/GASAttributeSet.h"
#include "Net/UnrealNetwork.h"
#include "GameplayEffectExtension.h"
#include "AbilitySystemComponent.h"

UGASAttributeSet::UGASAttributeSet()
{
    InitHealth(100.f);
    InitMaxHealth(100.f);
    InitMana(50.f);
    InitMaxMana(50.f);
    InitStamina(100.f);
    InitMaxStamina(100.f);
    InitAttackPower(25.f);
}

void UGASAttributeSet::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);

    DOREPLIFETIME_CONDITION_NOTIFY(UGASAttributeSet, Health, COND_None, REPNOTIFY_Always);
    DOREPLIFETIME_CONDITION_NOTIFY(UGASAttributeSet, MaxHealth, COND_None, REPNOTIFY_Always);
    DOREPLIFETIME_CONDITION_NOTIFY(UGASAttributeSet, Mana, COND_None, REPNOTIFY_Always);
    DOREPLIFETIME_CONDITION_NOTIFY(UGASAttributeSet, MaxMana, COND_None, REPNOTIFY_Always);
    DOREPLIFETIME_CONDITION_NOTIFY(UGASAttributeSet, Stamina, COND_None, REPNOTIFY_Always);
    DOREPLIFETIME_CONDITION_NOTIFY(UGASAttributeSet, MaxStamina, COND_None, REPNOTIFY_Always);
    DOREPLIFETIME_CONDITION_NOTIFY(UGASAttributeSet, AttackPower, COND_None, REPNOTIFY_Always);
}

void UGASAttributeSet::PreAttributeChange(const FGameplayAttribute& Attribute, float& NewValue)
{
    Super::PreAttributeChange(Attribute, NewValue);

    if (Attribute == GetMaxHealthAttribute())
    {
        NewValue = FMath::Max<float>(NewValue, 0.0f);
    }
    else if (Attribute == GetMaxManaAttribute())
    {
        NewValue = FMath::Max<float>(NewValue, 0.0f);
    }
    else if (Attribute == GetMaxStaminaAttribute())
    {
        NewValue = FMath::Max<float>(NewValue, 0.0f);
    }
}

void UGASAttributeSet::PostGameplayEffectExecute(const FGameplayEffectModCallbackData& Data)
{
    Super::PostGameplayEffectExecute(Data);

    if (Data.EvaluatedData.Attribute == GetHealthAttribute())
    {
        SetHealth(FMath::Clamp(GetHealth(), 0.f, GetMaxHealth()));
    }
    else if (Data.EvaluatedData.Attribute == GetManaAttribute())
    {
        SetMana(FMath::Clamp(GetMana(), 0.f, GetMaxMana()));
    }
    else if (Data.EvaluatedData.Attribute == GetStaminaAttribute())
    {
        SetStamina(FMath::Clamp(GetStamina(), 0.f, GetMaxStamina()));
    }
}

void UGASAttributeSet::OnRep_Health(const FGameplayAttributeData& OldHealth)
{
    GAMEPLAYATTRIBUTE_REPNOTIFY(UGASAttributeSet, Health, OldHealth);
}

void UGASAttributeSet::OnRep_MaxHealth(const FGameplayAttributeData& OldMaxHealth)
{
    GAMEPLAYATTRIBUTE_REPNOTIFY(UGASAttributeSet, MaxHealth, OldMaxHealth);
}

void UGASAttributeSet::OnRep_Mana(const FGameplayAttributeData& OldMana)
{
    GAMEPLAYATTRIBUTE_REPNOTIFY(UGASAttributeSet, Mana, OldMana);
}

void UGASAttributeSet::OnRep_MaxMana(const FGameplayAttributeData& OldMaxMana)
{
    GAMEPLAYATTRIBUTE_REPNOTIFY(UGASAttributeSet, MaxMana, OldMaxMana);
}

void UGASAttributeSet::OnRep_Stamina(const FGameplayAttributeData& OldStamina)
{
    GAMEPLAYATTRIBUTE_REPNOTIFY(UGASAttributeSet, Stamina, OldStamina);
}

void UGASAttributeSet::OnRep_MaxStamina(const FGameplayAttributeData& OldMaxStamina)
{
    GAMEPLAYATTRIBUTE_REPNOTIFY(UGASAttributeSet, MaxStamina, OldMaxStamina);
}

void UGASAttributeSet::OnRep_AttackPower(const FGameplayAttributeData& OldAttackPower)
{
    GAMEPLAYATTRIBUTE_REPNOTIFY(UGASAttributeSet, AttackPower, OldAttackPower);
}

```

2. GameplayTags - 태그 시스템

*GASGameplayTags.h*

```
#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"
#include "NativeGameplayTags.h"

namespace GASProjectTags
{
    UE_DECLARE_GAMEPLAY_TAG_EXTERN(Ability_Melee);
    UE_DECLARE_GAMEPLAY_TAG_EXTERN(Ability_Melee_Light);
    UE_DECLARE_GAMEPLAY_TAG_EXTERN(Ability_Dash);
    UE_DECLARE_GAMEPLAY_TAG_EXTERN(Ability_Heal);
    UE_DECLARE_GAMEPLAY_TAG_EXTERN(Ability_Buff);

    UE_DECLARE_GAMEPLAY_TAG_EXTERN(Cooldown_Dash);
    UE_DECLARE_GAMEPLAY_TAG_EXTERN(Cooldown_Heal);

    UE_DECLARE_GAMEPLAY_TAG_EXTERN(Status_Poisoned);
    UE_DECLARE_GAMEPLAY_TAG_EXTERN(Status_Buffed);

    UE_DECLARE_GAMEPLAY_TAG_EXTERN(GameplayCue_Melee_Swing);
    UE_DECLARE_GAMEPLAY_TAG_EXTERN(GameplayCue_Melee_Hit);
    UE_DECLARE_GAMEPLAY_TAG_EXTERN(GameplayCue_Status_Poisoned);
    UE_DECLARE_GAMEPLAY_TAG_EXTERN(GameplayCue_Dash);
    UE_DECLARE_GAMEPLAY_TAG_EXTERN(GameplayCue_Heal);

    UE_DECLARE_GAMEPLAY_TAG_EXTERN(SetByCaller_Damage);
    UE_DECLARE_GAMEPLAY_TAG_EXTERN(SetByCaller_Force);
}

```

3. Character 클래스 - GAS 통합

*GASCharacter.h*

```
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "AbilitySystemInterface.h"
#include "GASCharacter.generated.h"

class UAbilitySystemComponent;
class UGASAttributeSet;
class UGameplayAbility;
class UInputMappingContext;
class UInputAction;
struct FInputActionValue;

UCLASS()
class GASPROJECT_API AGASCharacter : public ACharacter, public IAbilitySystemInterface
{
    GENERATED_BODY()

public:
    AGASCharacter();
    virtual UAbilitySystemComponent* GetAbilitySystemComponent() const override;

protected:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="GAS")
    UAbilitySystemComponent* AbilitySystemComponent;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="GAS")
    UGASAttributeSet* AttributeSet;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="GAS|Abilities")
    TArray<TSubclassOf<UGameplayAbility>> StartupAbilities;

    UPROPERTY(EditDefaultsOnly, Category="Input")
    UInputMappingContext* DefaultMappingContext;

    UPROPERTY(EditDefaultsOnly, Category="Input")
    UInputAction* MoveAction;

    UPROPERTY(EditDefaultsOnly, Category="Input")
    UInputAction* LookAction;

    UPROPERTY(EditDefaultsOnly, Category="Input")
    UInputAction* DashAction;

    UPROPERTY(EditDefaultsOnly, Category="Input")
    UInputAction* AttackAction;

    UPROPERTY(EditDefaultsOnly, Category="Input")
    UInputAction* HealAction;

    UPROPERTY(EditDefaultsOnly, Category="Input")
    UInputAction* BuffAction;

    virtual void BeginPlay() override;
    virtual void SetupPlayerInputComponent(class UInputComponent* PlayerInputComponent) override;

    void Move(const FInputActionValue& Value);
    void Look(const FInputActionValue& Value);

    void InputDash();
    void InputAttack();
    void InputHeal();
    void InputBuff();

private:
    void InitializeAbilities();
    void BindASCInput();
};

```

*GASCharacter.cpp*

```
#include "Character/GASCharacter.h"
#include "AbilitySystemComponent.h"
#include "GAS/GASAttributeSet.h"
#include "GAS/GASGameplayTags.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "InputActionValue.h"
#include "Engine/LocalPlayer.h"

AGASCharacter::AGASCharacter()
{
    PrimaryActorTick.bCanEverTick = false;
    bReplicates = true;

    AbilitySystemComponent = CreateDefaultSubobject<UAbilitySystemComponent>(TEXT("AbilitySystemComp"));
    AbilitySystemComponent->SetIsReplicated(true);
    AbilitySystemComponent->SetReplicationMode(EGameplayEffectReplicationMode::Minimal);

    AttributeSet = CreateDefaultSubobject<UGASAttributeSet>(TEXT("AttributeSet"));
}

void AGASCharacter::BeginPlay()
{
    Super::BeginPlay();

    if (AbilitySystemComponent)
    {
        AbilitySystemComponent->InitAbilityActorInfo(this, this);
        InitializeAbilities();
        BindASCInput();
    }

    if (APlayerController* PlayerController = Cast<APlayerController>(Controller))
    {
        if (UEnhancedInputLocalPlayerSubsystem* Subsystem =
            ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(
                PlayerController->GetLocalPlayer()))
        {
            if (DefaultMappingContext)
            {
                Subsystem->AddMappingContext(DefaultMappingContext, 0);
            }
        }
    }
}

void AGASCharacter::InitializeAbilities()
{
    if (!HasAuthority() || !AbilitySystemComponent)
        return;

    for (TSubclassOf<UGameplayAbility>& AbilityClass : StartupAbilities)
    {
        if (AbilityClass)
        {
            FGameplayAbilitySpec AbilitySpec(AbilityClass, 1, INDEX_NONE, this);
            AbilitySystemComponent->GiveAbility(AbilitySpec);
        }
    }
}

void AGASCharacter::BindASCInput()
{
    if (!AbilitySystemComponent || !IsValid(InputComponent))
        return;

    // (레거시) Confirm/Cancel 바인딩이 필요한 경우 사용 가능
    AbilitySystemComponent->BindAbilityActivationToInputComponent(
        InputComponent,
        FGameplayAbilityInputBinds(
            FString("ConfirmTarget"),
            FString("CancelTarget"),
            FString("EGASAbilityInputID"),
            static_cast<int32>(0),
            static_cast<int32>(1)
        )
    );
}

void AGASCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    Super::SetupPlayerInputComponent(PlayerInputComponent);

    if (UEnhancedInputComponent* EnhancedInputComponent =
        Cast<UEnhancedInputComponent>(PlayerInputComponent))
    {
        if (MoveAction)
            EnhancedInputComponent->BindAction(MoveAction, ETriggerEvent::Triggered, this, &AGASCharacter::Move);

        if (LookAction)
            EnhancedInputComponent->BindAction(LookAction, ETriggerEvent::Triggered, this, &AGASCharacter::Look);

        if (DashAction)
            EnhancedInputComponent->BindAction(DashAction, ETriggerEvent::Started, this, &AGASCharacter::InputDash);

        if (AttackAction)
            EnhancedInputComponent->BindAction(AttackAction, ETriggerEvent::Started, this, &AGASCharacter::InputAttack);

        if (HealAction)
            EnhancedInputComponent->BindAction(HealAction, ETriggerEvent::Started, this, &AGASCharacter::InputHeal);

        if (BuffAction)
            EnhancedInputComponent->BindAction(BuffAction, ETriggerEvent::Started, this, &AGASCharacter::InputBuff);
    }
}

UAbilitySystemComponent* AGASCharacter::GetAbilitySystemComponent() const
{
    return AbilitySystemComponent;
}

void AGASCharacter::Move(const FInputActionValue& Value)
{
    const FVector2D MovementVector = Value.Get<FVector2D>();

    if (Controller)
    {
        const FRotator Rotation = Controller->GetControlRotation();
        const FRotator YawRotation(0, Rotation.Yaw, 0);
        const FVector ForwardDirection = FRotationMatrix(YawRotation).GetUnitAxis(EAxis::X);
        const FVector RightDirection = FRotationMatrix(YawRotation).GetUnitAxis(EAxis::Y);

        AddMovementInput(ForwardDirection, MovementVector.Y);
        AddMovementInput(RightDirection,  MovementVector.X);
    }
}

void AGASCharacter::Look(const FInputActionValue& Value)
{
    const FVector2D LookAxisVector = Value.Get<FVector2D>();

    if (Controller)
    {
        AddControllerYawInput(LookAxisVector.X);
        AddControllerPitchInput(LookAxisVector.Y);
    }
}

void AGASCharacter::InputDash()
{
    if (AbilitySystemComponent)
    {
        AbilitySystemComponent->TryActivateAbilitiesByTag(
            FGameplayTagContainer(GASProjectTags::Ability_Dash)
        );
    }
}

void AGASCharacter::InputAttack()
{
    if (AbilitySystemComponent)
    {
        AbilitySystemComponent->TryActivateAbilitiesByTag(
            FGameplayTagContainer(GASProjectTags::Ability_Melee_Light)
        );
    }
}

void AGASCharacter::InputHeal()
{
    if (AbilitySystemComponent)
    {
        AbilitySystemComponent->TryActivateAbilitiesByTag(
            FGameplayTagContainer(GASProjectTags::Ability_Heal)
        );
    }
}

void AGASCharacter::InputBuff()
{
    if (AbilitySystemComponent)
    {
        AbilitySystemComponent->TryActivateAbilitiesByTag(
            FGameplayTagContainer(GASProjectTags::Ability_Buff)
        );
    }
}
```

4. GameplayAbility - 스킬 시스템

*GA_MeleeAttack.h*

```
#pragma once

#include "CoreMinimal.h"
#include "Abilities/GameplayAbility.h"
#include "GA_MeleeAttack.generated.h"

UCLASS()
class GASPROJECT_API UGA_MeleeAttack : public UGameplayAbility
{
    GENERATED_BODY()

public:
    UGA_MeleeAttack();

protected:
    virtual void ActivateAbility(
        const FGameplayAbilitySpecHandle Handle,
        const FGameplayAbilityActorInfo* ActorInfo,
        const FGameplayAbilityActivationInfo ActivationInfo,
        const FGameplayEventData* TriggerEventData) override;

    virtual void EndAbility(
        const FGameplayAbilitySpecHandle Handle,
        const FGameplayAbilityActorInfo* ActorInfo,
        const FGameplayAbilityActivationInfo ActivationInfo,
        bool bReplicateEndAbility,
        bool bWasCancelled) override;

    UPROPERTY(EditDefaultsOnly, Category="Animation")
    UAnimMontage* AttackMontage;

    UPROPERTY(EditDefaultsOnly, Category="Damage")
    TSubclassOf<class UGameplayEffect> DamageEffectClass;

    UPROPERTY(EditDefaultsOnly, Category="Damage")
    float BaseDamage = 25.0f;

    UPROPERTY(EditDefaultsOnly, Category="HitDetection")
    float HitRadius = 100.0f;

    UPROPERTY(EditDefaultsOnly, Category="HitDetection")
    float HitRange = 150.0f;

private:
    void PerformMeleeAttack();
    void ApplyDamageToTarget(AActor* Target);
    TArray<AActor*> PerformHitDetection(const FVector& /*HitLocation*/);

    FTimerHandle HitCheckTimer;
    FTimerHandle EndAbilityTimer;
};

```

*GA_MeleeAttack.cpp*

```
#include "Abilities/GA_MeleeAttack.h"
#include "AbilitySystemComponent.h"
#include "AbilitySystemBlueprintLibrary.h"
#include "GAS/GASGameplayTags.h"
#include "GameFramework/Character.h"
#include "Engine/World.h"
#include "TimerManager.h"

UGA_MeleeAttack::UGA_MeleeAttack()
{
    InstancingPolicy = EGameplayAbilityInstancingPolicy::InstancedPerExecution;
    NetExecutionPolicy = EGameplayAbilityNetExecutionPolicy::LocalPredicted;
    bServerRespectsRemoteAbilityCancellation = true;

    AbilityTags.AddTag(GASProjectTags::Ability_Melee_Light);
    ActivationOwnedTags.AddTag(GASProjectTags::Ability_Melee_Light);
}

void UGA_MeleeAttack::ActivateAbility(
    const FGameplayAbilitySpecHandle Handle,
    const FGameplayAbilityActorInfo* ActorInfo,
    const FGameplayAbilityActivationInfo ActivationInfo,
    const FGameplayEventData* TriggerEventData)
{
    if (!CommitAbility(Handle, ActorInfo, ActivationInfo))
    {
        EndAbility(Handle, ActorInfo, ActivationInfo, true, true);
        return;
    }

    UAbilitySystemComponent* ASC = ActorInfo->AbilitySystemComponent.Get();
    if (!ASC)
    {
        EndAbility(Handle, ActorInfo, ActivationInfo, true, true);
        return;
    }

    FGameplayCueParameters CueParams;
    CueParams.SourceObject = GetAvatarActorFromActorInfo();
    CueParams.Location = GetAvatarActorFromActorInfo()->GetActorLocation();
    ASC->ExecuteGameplayCue(GASProjectTags::GameplayCue_Melee_Swing, CueParams);

    if (AttackMontage)
    {
        ACharacter* Character = CastChecked<ACharacter>(ActorInfo->AvatarActor.Get());
        Character->PlayAnimMontage(AttackMontage);

        FTimerDelegate HitDelegate;
        HitDelegate.BindUObject(this, &UGA_MeleeAttack::PerformMeleeAttack);
        GetWorld()->GetTimerManager().SetTimer(HitCheckTimer, HitDelegate, 0.4f, false);

        FTimerDelegate EndDelegate;
        EndDelegate.BindLambda([this, Handle, ActorInfo, ActivationInfo]()
        {
            EndAbility(Handle, ActorInfo, ActivationInfo, true, false);
        });
        GetWorld()->GetTimerManager().SetTimer(EndAbilityTimer, EndDelegate, 1.0f, false);
    }
    else
    {
        PerformMeleeAttack();
        EndAbility(Handle, ActorInfo, ActivationInfo, true, false);
    }
}

void UGA_MeleeAttack::PerformMeleeAttack()
{
    const FGameplayAbilityActorInfo* Info = GetCurrentActorInfo();
    UAbilitySystemComponent* ASC = Info ? Info->AbilitySystemComponent.Get() : nullptr;
    if (!ASC) return;

    FVector Forward = GetAvatarActorFromActorInfo()->GetActorForwardVector();
    FVector ActorLoc = GetAvatarActorFromActorInfo()->GetActorLocation();
    FVector HitLocation = ActorLoc + (Forward * HitRange);

    FGameplayCueParameters HitParams;
    HitParams.Location = HitLocation;
    ASC->ExecuteGameplayCue(GASProjectTags::GameplayCue_Melee_Hit, HitParams);

    if (HasAuthority(&CurrentActivationInfo))
    {
        TArray<AActor*> HitActors = PerformHitDetection(ActorLoc);
        for (AActor* Target : HitActors)
        {
            ApplyDamageToTarget(Target);
        }
    }
}

TArray<AActor*> UGA_MeleeAttack::PerformHitDetection(const FVector& /*HitLocation*/)
{
    TArray<AActor*> HitActors;

    FCollisionQueryParams QueryParams;
    QueryParams.AddIgnoredActor(GetAvatarActorFromActorInfo());

    FVector Start = GetAvatarActorFromActorInfo()->GetActorLocation();
    FVector End = Start + (GetAvatarActorFromActorInfo()->GetActorForwardVector() * HitRange);

    TArray<FHitResult> HitResults;
    GetWorld()->SweepMultiByChannel(
        HitResults,
        Start,
        End,
        FQuat::Identity,
        ECC_Pawn,
        FCollisionShape::MakeSphere(HitRadius),
        QueryParams
    );

    for (const FHitResult& Hit : HitResults)
    {
        AActor* HitActor = Hit.GetActor();
        if (HitActor &&
            !HitActors.Contains(HitActor) &&
            UAbilitySystemBlueprintLibrary::GetAbilitySystemComponent(HitActor))
        {
            HitActors.Add(HitActor);
        }
    }
    return HitActors;
}

void UGA_MeleeAttack::ApplyDamageToTarget(AActor* Target)
{
    if (!Target || !DamageEffectClass) return;

    const FGameplayAbilityActorInfo* Info = GetCurrentActorInfo();
    UAbilitySystemComponent* SourceASC = Info ? Info->AbilitySystemComponent.Get() : nullptr;
    if (!SourceASC) return;

    UAbilitySystemComponent* TargetASC = UAbilitySystemBlueprintLibrary::GetAbilitySystemComponent(Target);
    if (!TargetASC) return;

    FGameplayEffectContextHandle ContextHandle = SourceASC->MakeEffectContext();
    ContextHandle.AddSourceObject(this);

    FGameplayEffectSpecHandle DamageSpec = SourceASC->MakeOutgoingSpec(
        DamageEffectClass,
        GetAbilityLevel(),
        ContextHandle
    );

    if (DamageSpec.IsValid())
    {
        DamageSpec.Data->SetSetByCallerMagnitude(
            GASProjectTags::SetByCaller_Damage,
            -BaseDamage
        );

        SourceASC->ApplyGameplayEffectSpecToTarget(*DamageSpec.Data.Get(), TargetASC);
    }
}

void UGA_MeleeAttack::EndAbility(
    const FGameplayAbilitySpecHandle Handle,
    const FGameplayAbilityActorInfo* ActorInfo,
    const FGameplayAbilityActivationInfo ActivationInfo,
    bool bReplicateEndAbility,
    bool bWasCancelled)
{
    if (GetWorld())
    {
        GetWorld()->GetTimerManager().ClearTimer(HitCheckTimer);
        GetWorld()->GetTimerManager().ClearTimer(EndAbilityTimer);
    }

    if (bWasCancelled)
    {
        if (ACharacter* Character = Cast<ACharacter>(ActorInfo->AvatarActor.Get()))
        {
            Character->StopAnimMontage();
        }
    }

    Super::EndAbility(Handle, ActorInfo, ActivationInfo, bReplicateEndAbility, bWasCancelled);
}
```

5. Dash 어빌리티 - 이동 스킬

*GA_Dash.h*

```
#pragma once

#include "CoreMinimal.h"
#include "Abilities/GameplayAbility.h"
#include "GA_Dash.generated.h"

UCLASS()
class GASPROJECT_API UGA_Dash : public UGameplayAbility
{
    GENERATED_BODY()

public:
    UGA_Dash();

protected:
    virtual void ActivateAbility(
        const FGameplayAbilitySpecHandle Handle,
        const FGameplayAbilityActorInfo* ActorInfo,
        const FGameplayAbilityActivationInfo ActivationInfo,
        const FGameplayEventData* TriggerEventData) override;

    virtual void EndAbility(
        const FGameplayAbilitySpecHandle Handle,
        const FGameplayAbilityActorInfo* ActorInfo,
        const FGameplayAbilityActivationInfo ActivationInfo,
        bool bReplicateEndAbility,
        bool bWasCancelled) override;

    UPROPERTY(EditDefaultsOnly, Category="Dash")
    float DashDistance = 1000.f;

    UPROPERTY(EditDefaultsOnly, Category="Dash")
    float DashDuration = 0.2f;

private:
    UFUNCTION()
    void OnDashFinished();
};

```

*GA_Dash.cpp*

```
#include "Abilities/GA_Dash.h"
#include "Abilities/Tasks/AbilityTask_ApplyRootMotionConstantForce.h"
#include "Abilities/Tasks/AbilityTask_WaitDelay.h"
#include "AbilitySystemComponent.h"
#include "GAS/GASGameplayTags.h"
#include "Effects/GE_DashCooldown.h"
#include "GameFramework/Character.h"

UGA_Dash::UGA_Dash()
{
    InstancingPolicy = EGameplayAbilityInstancingPolicy::InstancedPerActor;
    NetExecutionPolicy = EGameplayAbilityNetExecutionPolicy::LocalPredicted;

    AbilityTags.AddTag(GASProjectTags::Ability_Dash);
    ActivationOwnedTags.AddTag(GASProjectTags::Ability_Dash);

    // 쿨다운은 이 GE가 적용되며, GE가 "부여하는 태그(Owned Tags)"로 차단
    CooldownGameplayEffectClass = UGE_DashCooldown::StaticClass();

    // 어빌리티에 임의 컨테이너를 두고 태그를 넣을 필요가 없음
    // 기본 구현은 Cooldown GE가 부여하는 태그를 통해 차단/조회
}

void UGA_Dash::ActivateAbility(
    const FGameplayAbilitySpecHandle Handle,
    const FGameplayAbilityActorInfo* ActorInfo,
    const FGameplayAbilityActivationInfo ActivationInfo,
    const FGameplayEventData* TriggerEventData)
{
    if (!CommitAbility(Handle, ActorInfo, ActivationInfo))
    {
        EndAbility(Handle, ActorInfo, ActivationInfo, true, false);
        return;
    }

    ACharacter* Character = CastChecked<ACharacter>(ActorInfo->AvatarActor.Get());
    const FVector Direction = Character->GetActorForwardVector();
    const float Strength = DashDistance / DashDuration;

    UAbilityTask_ApplyRootMotionConstantForce* RMTask =
        UAbilityTask_ApplyRootMotionConstantForce::ApplyRootMotionConstantForce(
            this,
            NAME_None,
            Direction,
            Strength,
            DashDuration,
            false,
            nullptr,
            ERootMotionFinishVelocityMode::MaintainLastRootMotionVelocity,
            FVector::ZeroVector,
            0.0f,
            true
        );

    if (RMTask)
    {
        RMTask->ReadyForActivation();
    }

    FGameplayCueParameters CueParams;
    CueParams.SourceObject = Character;
    CueParams.Location = Character->GetActorLocation();
    ActorInfo->AbilitySystemComponent->ExecuteGameplayCue(
        GASProjectTags::GameplayCue_Dash,
        CueParams
    );

    UAbilityTask_WaitDelay* WaitTask = UAbilityTask_WaitDelay::WaitDelay(
        this,
        DashDuration
    );

    if (WaitTask)
    {
        WaitTask->OnFinish.AddDynamic(this, &UGA_Dash::OnDashFinished);
        WaitTask->ReadyForActivation();
    }
}

void UGA_Dash::OnDashFinished()
{
    EndAbility(CurrentSpecHandle, CurrentActorInfo, CurrentActivationInfo, true, false);
}

void UGA_Dash::EndAbility(
    const FGameplayAbilitySpecHandle Handle,
    const FGameplayAbilityActorInfo* ActorInfo,
    const FGameplayAbilityActivationInfo ActivationInfo,
    bool bReplicateEndAbility,
    bool bWasCancelled)
{
    Super::EndAbility(Handle, ActorInfo, ActivationInfo, bReplicateEndAbility, bWasCancelled);
}
```

6. GameplayEffect - 데미지/쿨다운

*GE_Damage.h*

```
#pragma once

#include "CoreMinimal.h"
#include "GameplayEffect.h"
#include "GE_Damage.generated.h"

UCLASS()
class GASPROJECT_API UGE_Damage : public UGameplayEffect
{
    GENERATED_BODY()

public:
    UGE_Damage();
};

```

*GE_Damage.cpp*

```
#include "Effects/GE_Damage.h"
#include "GAS/GASAttributeSet.h"
#include "GAS/GASGameplayTags.h"

UGE_Damage::UGE_Damage()
{
    DurationPolicy = EGameplayEffectDurationType::Instant;

    FGameplayModifierInfo DamageModifier;
    DamageModifier.Attribute = UGASAttributeSet::GetHealthAttribute();
    DamageModifier.ModifierOp = EGameplayModOp::Additive;

    FGameplayEffectModifierMagnitude ModMagnitude(FScalableFloat(0.f));
    ModMagnitude.SetSetByCallerMagnitude(GASProjectTags::SetByCaller_Damage);
    DamageModifier.ModifierMagnitude = ModMagnitude;

    Modifiers.Add(DamageModifier);
}

```

*GE_DashCooldown.cpp*

```
#include "Effects/GE_DashCooldown.h"
#include "GAS/GASGameplayTags.h"

UGE_DashCooldown::UGE_DashCooldown()
{
    DurationPolicy = EGameplayEffectDurationType::HasDuration;
    DurationMagnitude = FGameplayEffectModifierMagnitude(FScalableFloat(3.0f));

    InheritableOwnedTagsContainer.AddTag(GASProjectTags::Cooldown_Dash);
}
```