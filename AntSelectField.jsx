/**
 * 自定义下拉单选/多选
 *
 * 支持无限滚动加载
 * @param {boolean} checkAll 是否需要全选功能
 * 其余 api 和 antd select 相同
 */
import React from 'react';
import PropTypes from 'prop-types';
import { Select, Checkbox } from 'antd';
import _ from '@util';
import './AntSelectField.scss';

// 页面实际渲染的下拉菜单数量，实际为 2 * ITEM_ELEMENT_NUMBER
const ITEM_ELEMENT_NUMBER = 19;

// Select size 配置
const ITEM_HEIGHT_CFG = {
  small: 24,
  large: 40,
  medium: 32
};

// 下拉列表项左侧 √ icon
const selectIcon = (
  <i aria-label="icon: check" className="anticon anticon-check ant-select-selected-icon">
    <svg
      viewBox="64 64 896 896"
      className=""
      data-icon="check"
      width="1em"
      height="1em"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M912 190h-69.9c-9.8 0-19.1 4.5-25.1 12.2L404.7 724.5 207 474a32 32 0 0 0-25.1-12.2H112c-6.7 0-10.4 7.7-6.3 12.9l273.9 347c12.8 16.2 37.4 16.2 50.3 0l488.4-618.9c4.1-5.1.4-12.8-6.3-12.8z" />
    </svg>
  </i>
);

class Wrap extends React.PureComponent {
  static propTypes = {
    list: PropTypes.array,
    allHeight: PropTypes.number,
    onScroll: PropTypes.func
  };

  constructor(props) {
    super(props);
    this.state = {
      list: props.list,
      allHeight: props.allHeight
    };
  }
  reactList = (list, allHeight) => {
    this.setState({ list, allHeight });
  };
  render() {
    return (
      <div className="dropdown_content" onScroll={e => this.props.onScroll(e)}>
        <ul
          role="listbox"
          className="ant-select-dropdown-menu  ant-select-dropdown-menu-root ant-select-dropdown-menu-vertical"
          style={{
            height: this.state.allHeight + 10,
            maxHeight: this.state.allHeight + 10,
            overflow: 'hidden'
          }}
        >
          {this.state.list}
        </ul>
      </div>
    );
  }
}

class SelectField extends React.PureComponent {
  static propTypes = {
    mode: PropTypes.string,
    defaultValue: PropTypes.any,
    value: PropTypes.any,
    children: PropTypes.array,
    size: PropTypes.string,
    style: PropTypes.object,
    dropdownStyle: PropTypes.object,
    optionLabelProp: PropTypes.string,
    autoClearSearchValue: PropTypes.bool,
    showSearch: PropTypes.bool,
    filterOption: PropTypes.any,
    optionFilterProp: PropTypes.string,
    onDeselect: PropTypes.func,
    onSelect: PropTypes.func,
    placeholder: PropTypes.string,
    onChange: PropTypes.func,
    onSearch: PropTypes.func,
    getPopupContainer: PropTypes.func,
    checkAll: PropTypes.bool,
    maxTagCount: PropTypes.number,
    maxTagTextLength: PropTypes.number
  };

  static Option = Select.Option;
  static OptGroup = Select.OptGroup;

  static defaultProps = {
    filterOption: (input, item) => {
      return item.props.value.toLowerCase().indexOf(input.toLowerCase()) >= 0;
    }
  };

  constructor(props) {
    super(props);

    const { mode, defaultValue, value } = props;
    this.isMultiple = ['tags', 'multiple'].includes(mode);

    // 设置默认 value
    let defaultV = this.isMultiple ? [] : '';
    defaultV = value || defaultValue || defaultV;

    this.state = {
      children: props.children || [],
      filterChildren: null,
      value: defaultV
    };
    // 下拉菜单项行高
    this.ITEM_HEIGHT = ITEM_HEIGHT_CFG[props.size || 'medium'];
    // 可视区 dom 高度
    this.visibleDomHeight = this.ITEM_HEIGHT * ITEM_ELEMENT_NUMBER;
    // 滚动时重新渲染的 scrollTop 判断值
    this.reactDelta = (this.visibleDomHeight * 2) / 3;
    // 上一次滚动的 scrollTop 值
    this.prevScrollTop = 0;
    this.scrollTop = 0;

    // checkall
    this.computedCheckAll();
    //
    this.select = React.createRef();
  }

  componentDidUpdate(preprops) {
    if (preprops.value !== this.props.value) {
      this.setState({ value: this.props.value });
    }
    if (preprops.children !== this.props.children) {
      this.setState({ children: this.props.children }, () => this.computedReactList());
    }
  }

  getItemStyle = i => ({
    position: 'absolute',
    top: this.ITEM_HEIGHT * i,
    width: '100%',
    height: `${this.ITEM_HEIGHT}px`,
    lineHeight: `${this.ITEM_HEIGHT}px`
  });

  onScroll = e => this.throttleByHeight(e);
  onScrollReal = () => {
    this.allList = this.getUseChildrenList();
    this.showList = this.getVisibleOptions();

    this.prevScrollTop = this.scrollTop;
    // 重新渲染列表组件 Wrap
    let allHeight = this.allList.length * this.ITEM_HEIGHT || 100;
    this.wrap.reactList(this.showList, allHeight);
  };
  throttleByHeight = e => {
    this.scrollTop = e.target.scrollTop;

    let delta = this.prevScrollTop - this.scrollTop;
    delta = delta < 0 ? 0 - delta : delta;

    // 滚动约 2/3 可视区 dom 高度时刷新 dom
    delta > this.reactDelta && this.onScrollReal();
  };

  // 列表可展示所有 children
  getUseChildrenList = () => this.state.filterChildren || this.state.children;

  getStartAndEndIndex = () => {
    // 滚动后显示在列表可视区中的第一个 item 的 index
    const showIndex = Number((this.scrollTop / this.ITEM_HEIGHT).toFixed(0));

    const startIndex = showIndex - ITEM_ELEMENT_NUMBER < 0 ? 0 : showIndex - ITEM_ELEMENT_NUMBER / 2;
    const endIndex = showIndex + ITEM_ELEMENT_NUMBER;
    return { startIndex, endIndex };
  };

  getVisibleList = () => {
    // 搜索时使用过滤后的列表
    const { startIndex, endIndex } = this.getStartAndEndIndex();
    // 渲染的 list
    return this.allList.slice(startIndex, endIndex);
  };

  getVisibleOptions = () => {
    const visibleList = this.getVisibleList();
    const { startIndex } = this.getStartAndEndIndex();

    // 显示中的列表元素添加相对定位样式
    return visibleList.map((item, i) => {
      let props = { ...item.props };
      const text = props.children;

      const realIndex = startIndex + Number(i);
      const key = props.key || realIndex;
      const { value } = this.state;
      const valiValue = props.value;
      const isSelected = value && (value.includes ? value.includes(valiValue) : value == valiValue);
      const classes = `ant-select-dropdown-menu-item ${isSelected ? 'ant-select-dropdown-menu-item-selected' : ''}`;

      props._childrentext = text;
      return (
        <li
          className={classes}
          key={key}
          onMouseDown={() => this.onClick(props, item)}
          {...props}
          style={this.getItemStyle(realIndex)}
        >
          {text}
          {/* 多选项选中状态 √ 图标 */}
          {this.isMultiple ? selectIcon : null}
        </li>
      );
    });
  };

  onDropdownVisibleChange = open => {
    this.computedReactList();
    if (this.lock) return;
    this.computedCheckAll();
    this.setState({ open });
    // 关闭弹窗时重置搜索列表
    if (open === false) {
      this.onSearch('');
    }
  };

  computedReactList() {
    this.allList = this.getUseChildrenList();
    this.showList = this.getVisibleOptions();
    let allHeight = this.allList.length * this.ITEM_HEIGHT || 100;
    this.wrap && this.wrap.reactList(this.showList, allHeight);
  }

  /**
   * itemProps: li react 元素的 props
   * item: li 元素
   */
  onClick = (itemProps, item) => {
    let { value } = itemProps;
    const { onDeselect } = this.props;

    let newValue = this.state.value || [];

    if (this.isMultiple) {
      newValue = [...newValue];
      // 点击选中项取消选中操作
      if (newValue.includes(value)) {
        newValue = newValue.filter(i => i !== value);
        onDeselect && onDeselect(value, item);
      } else {
        newValue.push(value);
      }
    } else {
      newValue = value;
    }

    // 多选模式点击选择后下拉框持续显示
    this.isMultiple && this.focusSelect();
    this.onChange(newValue);
    this.onSelect(newValue);
  };

  // 全选
  onCheckAll() {
    let filterValue = (this.state.filterChildren || this.state.children).map(item => item.props.value);
    let newValue = this.state.value || [];
    newValue = [...newValue];

    if (!this.state.checkAll) {
      newValue = newValue.concat(filterValue);
      newValue = _.getUniqueArray(newValue);
    } else {
      for (let i = newValue.length - 1; i >= 0; i--) {
        if (_.indexOf(filterValue, item => item === newValue[i]) > -1) {
          newValue.splice(i, 1);
        }
      }
    }

    this.focusSelect();
    this.onChange(newValue);
    this.onSelect(newValue);

    // 全选有时不自动触发 onDropdownVisibleChange
    setTimeout(() => {
      this.onDropdownVisibleChange(false);
    }, 100);
  }

  // 非 antd select 定义元素点击后会失去焦点，手动再次获取焦点
  focusSelect = () => setTimeout(() => this.select.current && this.select.current.focus(), 100);

  // value: 所有选中的 values
  onSelect = (value, opt) => {
    const { onSelect } = this.props;
    onSelect && onSelect(value, opt);
  };
  onChange = (value, opt) => {
    const { onChange } = this.props;

    // 多选阻止弹窗关闭
    if (this.isMultiple) {
      this.lockClose();
    }
    this.setState({ value }, () => {
      this.computedCheckAll();
      this.computedReactList();
    });
    onChange && onChange(value, opt);
  };

  onSearch = v => {
    let { showSearch, onSearch, filterOption, children } = this.props;
    if (showSearch && filterOption !== false) {
      // 须根据 filterOption（如有该自定义函数）手动 filter 搜索匹配的列表
      let filterChildren = null;
      if (typeof filterOption === 'function') {
        filterChildren = children.filter(item => filterOption(v, item));
      } else if (filterOption === undefined) {
        filterChildren = children.filter(item => this.filterOption(v, item));
      }
      // 设置下拉列表显示数据
      this.setState({ filterChildren: v === '' ? null : filterChildren }, () => {
        // 搜索成功后需要重新设置列表的总高度
        this.computedReactList();
        this.computedCheckAll();
      });
    }
    onSearch && onSearch(v);
  };

  filterOption = (v, option) => {
    // 自定义过滤对应的 option 属性配置
    const filterProps = this.props.optionFilterProp || 'value';
    return `${option.props[filterProps]}`.indexOf(v) >= 0;
  };

  computedCheckAll = () => {
    const { filterChildren, children, value } = this.state;
    let checkAll = true;
    if ((filterChildren || children).length === 0) {
      checkAll = false;
    }
    (filterChildren || children).some(item => {
      if (!(_.find(value, v => v === item.props.value) !== undefined)) {
        checkAll = false;
        return true;
      }
    });
    this.setState({ checkAll });
  };

  lockClose = () => {
    clearTimeout(this.lock);
    this.lock = setTimeout(() => {
      this.lock = null;
    }, 200);
  };

  render() {
    let {
      style,
      optionLabelProp,
      maxTagCount,
      maxTagTextLength,
      checkAll,
      getPopupContainer,
      placeholder,
      ...props
    } = this.props;
    this.allList = this.getUseChildrenList();
    this.showList = this.getVisibleOptions();

    let allHeight = this.allList.length * this.ITEM_HEIGHT || 100;

    let selectStyle = {
      ...style,
      width: '100%'
    };

    // 设置显示在输入框的文本，替换 children 为自定义 childrentext,默认 children 会包含 √ icon
    optionLabelProp = optionLabelProp ? optionLabelProp : '_childrentext';
    optionLabelProp = optionLabelProp === 'children' ? '_childrentext' : optionLabelProp;

    return (
      <Select
        {...props}
        style={selectStyle}
        onSearch={this.onSearch}
        onChange={this.onChange}
        onSelect={this.onSelect}
        value={this.state.value || ''}
        open={this.state.open}
        optionLabelProp={optionLabelProp}
        dropdownClassName={'m-selectField-dropdown'}
        onDropdownVisibleChange={this.onDropdownVisibleChange}
        maxTagCount={maxTagCount || 10}
        maxTagTextLength={maxTagTextLength || 10}
        getPopupContainer={getPopupContainer}
        ref={this.select}
        placeholder={placeholder || '请选择'}
        dropdownRender={() => {
          if (this.showList.length == 0) {
            return <>无选项</>;
          }
          return (
            <>
              <If condition={this.isMultiple && checkAll}>
                <ul className="ant-select-dropdown-menu  ant-select-dropdown-menu-root ant-select-dropdown-menu-vertical checkAll">
                  <li className="ant-select-dropdown-menu-item" onMouseDown={() => this.onCheckAll()}>
                    <Checkbox checked={this.state.checkAll}>全选</Checkbox>
                  </li>
                </ul>
              </If>
              <Wrap
                ref={ele => (this.wrap = ele)}
                allHeight={allHeight}
                list={this.showList}
                onScroll={this.onScroll}
              />
            </>
          );
        }}
      >
        {this.showList}
      </Select>
    );
  }
}

SelectField.Option = Select.Option;
export default SelectField;
